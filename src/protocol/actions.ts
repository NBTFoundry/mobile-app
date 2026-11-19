// SPDX-License-Identifier: MPL-2.0
/** One flow per action. The car confirms pairing, installs and uninstalls; the phone only follows. */
import { ProtocolError, fromAscii } from './bytes';
import { parseApps, parseOk, parsePair, parseSettings, parseStatus, parseWake,
  type CarApp, type Setting, type Status, type StatusState, type WakeState } from './replies';
import { CarError, type CarSession, type SavedReply } from './session';
import { pairBody, pairingCode } from './signing';

/** Set `cancelled` to stop following; the car keeps its own state. */
export type Cancel = { cancelled: boolean };
export type Wait = (ms: number) => Promise<void>;
export const realWait: Wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export class StoppedFollowing extends Error {
  constructor() {
    super('stopped');
    this.name = 'StoppedFollowing';
  }
}

const TERMINAL: readonly StatusState[] = ['installed', 'removed', 'failed', 'cancelled', 'expired', 'paired'];
export const isTerminal = (state: StatusState) => TERMINAL.includes(state);

export type Follow = { onStatus: (status: Status) => void; cancel: Cancel; wait: Wait };

/** Polls this key's last action until it ends, the deadline passes or the driver stops following. */
export async function followStatus(session: CarSession, follow: Follow, deadlineMs: number): Promise<Status> {
  const started = Date.now();
  for (;;) {
    if (follow.cancel.cancelled) throw new StoppedFollowing();
    const status = parseStatus((await session.ok('/v1/status')).body);
    follow.onStatus(status);
    if (isTerminal(status.state)) return status;
    if (Date.now() - started > deadlineMs) {
      return { state: 'expired', message: 'No result from the car' };
    }
    await follow.wait(1000);
  }
}

export type PairResult = { bssid: string; address: string };

/** Proposes this key; the driver compares the digits and confirms on the car. */
export async function pairPhone(session: CarSession, name: string, publicKeyHex: string,
  onCode: (digits: string) => void, follow: Follow): Promise<PairResult | Status> {
  const response = await session.ok('/v1/pair', { kind: 'text', text: fromAscii(pairBody(name, publicKeyHex)) });
  const digits = parsePair(response.body);
  if (response.status !== 202 || !session.usedNonce
    || digits !== pairingCode(session.usedNonce, publicKeyHex)) {
    throw new ProtocolError('code-mismatch');
  }
  onCode(digits);
  const status = await followStatus(session, follow, 90_000);
  return status.state === 'paired' && status.car ? status.car : status;
}

export async function listApps(session: CarSession): Promise<CarApp[]> {
  return parseApps((await session.ok('/v1/apps')).body);
}

/** An application's log on the car: its output and how it started and ended. */
export function readAppLog(session: CarSession, app: string): Promise<SavedReply> {
  return session.download('/v1/logs/app', { kind: 'text', text: `${app}\n` }, `app-${app.toLowerCase()}`);
}

/** Empties an application's log on the car. */
export async function clearAppLog(session: CarSession, app: string): Promise<void> {
  parseOk((await session.ok('/v1/logs/clear', { kind: 'text', text: `${app}\n` })).body);
}

/** The iDrive processor's system log (`sloginfo`), its newest part. */
export function readSystemLog(session: CarSession): Promise<SavedReply> {
  return session.download('/v1/logs/system', { kind: 'text', text: '' }, 'idrive');
}

/** NBT Manager's own debug log (debug.log.1, then debug.log); empty while it is off. */
export function readManagerLog(session: CarSession): Promise<SavedReply> {
  return session.download('/v1/logs/manager', { kind: 'text', text: '' }, 'manager');
}

export async function readSettings(session: CarSession, app: string): Promise<Setting[]> {
  return parseSettings((await session.ok('/v1/settings/read', { kind: 'text', text: `${app}\n` })).body);
}

/** Applied at once by the car, with no prompt there. */
export async function changeSetting(session: CarSession, app: string, key: string, value: string): Promise<void> {
  parseOk((await session.ok('/v1/settings/set', { kind: 'text', text: `${app}\t${key}\t${value}\n` })).body);
}

export type PackageFile = { uri: string; size: number; sha256: string };

/** Sends a package; the car reviews it and the driver confirms there. */
export async function installPackage(session: CarSession, file: PackageFile,
  onProgress: (sent: number, total: number) => void, follow: Follow): Promise<Status> {
  let response;
  try {
    response = await session.ok('/v1/upload', { kind: 'file', ...file }, onProgress);
  } catch (error) {
    // The car turns a package it rejects away with 400; its status says why.
    if (!(error instanceof CarError) || error.status !== 400) throw error;
    const status = parseStatus((await session.ok('/v1/status')).body);
    if (status.state !== 'failed') throw error;
    follow.onStatus(status);
    return status;
  }
  const first = parseStatus(response.body);
  follow.onStatus(first);
  return followStatus(session, follow, 11 * 60_000);
}

/** Asks the car to uninstall; the driver confirms there. */
export async function removeApp(session: CarSession, app: string, follow: Follow): Promise<Status> {
  const response = await session.ok('/v1/remove', { kind: 'text', text: `${app}\n` });
  follow.onStatus(parseStatus(response.body));
  return followStatus(session, follow, 2 * 60_000);
}

export async function wake(door: CarSession): Promise<WakeState> {
  try {
    return parseWake((await door.ok('/v1/wake', { kind: 'text', text: '' })).body);
  } catch (error) {
    if (error instanceof CarError && error.status === 429) return 'busy';
    throw error;
  }
}
