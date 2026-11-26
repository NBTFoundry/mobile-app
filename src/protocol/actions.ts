// SPDX-License-Identifier: MPL-2.0
/** One flow per action. The car confirms pairing, installs and uninstalls; the phone only follows. */
import { ProtocolError, fromAscii } from './bytes';
import { parseApps, parseAutostart, parseCrashes, parseKeys, parseManager, parseOk, parsePair, parseSettings,
  parseStatus, parseWake, type Autostart, type CarApp, type CarCrash, type CarKey, type CarManager, type Setting,
  type Status, type StatusState, type WakeState } from './replies';
import { parseCompanion, type CompanionPage } from './companion';
import { keyAddBody, type DeveloperKey } from './developerKey';
import { parseSelfTest, type SelfTestReport } from './selfTest';
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

const TERMINAL: readonly StatusState[] = ['installed', 'removed', 'failed', 'cancelled', 'expired', 'paired',
  'key-added', 'key-removed'];
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

/** An unknown route: 404, or 400 from managers that refuse it while parsing the request. */
const unknownRoute = (error: unknown) => error instanceof CarError && (error.status === 404
  || error.status === 400 && (error.code === 'route' || error.code === 'invalid-request'));

/** The last self test's report (NBT Manager's docs/self-test.md); null from a manager without it. */
export async function readSelfTest(session: CarSession): Promise<SelfTestReport | null> {
  try {
    return parseSelfTest((await session.ok('/v1/selftest')).body);
  } catch (error) {
    if (unknownRoute(error)) return null;
    throw error;
  }
}

/** Crash reports on the car, newest first: all applications' (and NBT Manager's), or `app`'s;
 * null from a manager without them (PROTOCOL.md, "Crash reports"). */
export async function listCrashes(session: CarSession, app?: string): Promise<CarCrash[] | null> {
  try {
    return parseCrashes((await session.ok('/v1/crashes', { kind: 'text', text: app ? `${app}\n` : '' })).body);
  } catch (error) {
    if (unknownRoute(error)) return null;
    throw error;
  }
}

/** One crash report, saved as a file. */
export function readCrash(session: CarSession, crash: CarCrash): Promise<SavedReply> {
  return session.download('/v1/crashes/read', { kind: 'text', text: `${crash.app}\t${crash.slot}\n` },
    `crash-${crash.app}-${crash.slot}`);
}

/** Removes the crash reports on the car: all of them, or `app`'s. */
export async function clearCrashes(session: CarSession, app?: string): Promise<void> {
  parseOk((await session.ok('/v1/crashes/clear', { kind: 'text', text: app ? `${app}\n` : '' })).body);
}

export async function readSettings(session: CarSession, app: string): Promise<Setting[]> {
  return parseSettings((await session.ok('/v1/settings/read', { kind: 'text', text: `${app}\n` })).body);
}

/** Applied at once by the car, with no prompt there. */
export async function changeSetting(session: CarSession, app: string, key: string, value: string): Promise<void> {
  parseOk((await session.ok('/v1/settings/set', { kind: 'text', text: `${app}\t${key}\t${value}\n` })).body);
}

/** An application's phone page; null when it has none, or from a manager without them. */
export async function readCompanion(session: CarSession, app: string): Promise<CompanionPage | null> {
  try {
    return parseCompanion((await session.ok('/v1/companion', { kind: 'text', text: `${app}\n` })).body);
  } catch (error) {
    if (error instanceof CarError && (error.status === 404 || error.status === 400 && error.code === 'route')) {
      return null;
    }
    throw error;
  }
}

/** A tap on the page: the widget's id and value (empty for a button). */
export async function sendCompanionEvent(session: CarSession, app: string, id: string, value: string): Promise<void> {
  parseOk((await session.ok('/v1/companion/event', { kind: 'text', text: `${app}\t${id}\t${value}\n` })).body);
}

/** Start with the car; null from a manager without it (an older release). */
export async function readAutostart(session: CarSession, app: string): Promise<Autostart | null> {
  try {
    return parseAutostart((await session.ok('/v1/autostart', { kind: 'text', text: `${app}\n` })).body);
  } catch (error) {
    if (error instanceof CarError && (error.status === 404 || error.status === 400 && error.code === 'route')) {
      return null;
    }
    throw error;
  }
}

/** The car's NBT Manager; null from a manager without the route, which reads releases only
 * up to NBTRLS2 (PROTOCOL.md, "Manager updates from a phone"). */
export async function readManager(session: CarSession): Promise<CarManager | null> {
  try {
    return parseManager((await session.ok('/v1/manager')).body);
  } catch (error) {
    if (unknownRoute(error)) return null;
    throw error;
  }
}

/** Applied at once by the car, with no prompt there; the pause stays until a start by hand. */
export async function changeAutostart(session: CarSession, app: string, on: boolean): Promise<void> {
  parseOk((await session.ok('/v1/autostart', { kind: 'text', text: `${app}\t${on ? 'on' : 'off'}\n` })).body);
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

/** The developer keys the car trusts; null from a manager without them. */
export async function listKeys(session: CarSession): Promise<CarKey[] | null> {
  try {
    return parseKeys((await session.ok('/v1/keys')).body);
  } catch (error) {
    if (unknownRoute(error)) return null;
    throw error;
  }
}

/** Asks the car to trust a developer key; the driver checks the fingerprint and confirms there. */
export async function addKey(session: CarSession, name: string, key: DeveloperKey, follow: Follow): Promise<Status> {
  const response = await session.ok('/v1/keys/add', { kind: 'text', text: keyAddBody(name, key) });
  follow.onStatus(parseStatus(response.body));
  return followStatus(session, follow, 2 * 60_000);
}

/** Asks the car to forget a developer key; the driver confirms there. */
export async function removeKey(session: CarSession, id: string, follow: Follow): Promise<Status> {
  const response = await session.ok('/v1/keys/remove', { kind: 'text', text: `${id}\n` });
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
