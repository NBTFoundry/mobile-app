/** Parsers for the car's reply bodies. Every reply is untrusted and bounded. */
import { ProtocolError, isU64 } from './bytes';
import { isHostPort } from './signing';

export const MAX_REPLY = 4096;

export type CarApp = { id: string; version: string; sequence: string; running: boolean };
export type Setting = { key: string; label: string; value: string; choices: string[] };
export const STATUS_STATES = ['waiting', 'verified', 'installing', 'installed', 'removed', 'failed',
  'cancelled', 'expired', 'paired'] as const;
export type StatusState = (typeof STATUS_STATES)[number];
export type Status = { state: StatusState; message: string; car?: { bssid: string; address: string } };
export const WAKE_STATES = ['opening', 'open', 'busy', 'moving', 'off'] as const;
export type WakeState = (typeof WAKE_STATES)[number];

const ID = /^[a-z0-9_-]{1,48}$/;
const VERSION = /^[A-Za-z0-9._-]{1,48}$/;
const KEY = /^[a-z][a-z0-9_]{0,15}$/;
const CHOICE = /^[a-z0-9_-]{1,12}$/;
const LABEL = /^[\x20-\x7b\x7d\x7e]{1,24}$/;
const MESSAGE = /^[\x20-\x7e]{1,256}$/;
const BSSID = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/;

const bad = (): never => {
  throw new ProtocolError('bad-reply');
};

/** Splits a reply into LF-terminated lines; the final LF is required. */
function lines(text: string, maxLines: number): string[] {
  if (text.length > MAX_REPLY || !text.endsWith('\n')) bad();
  const out = text.slice(0, -1).split('\n');
  if (out.length > maxLines) bad();
  return out;
}

function counted(text: string, tag: string, max: number): string[] {
  const all = lines(text, max + 1);
  const head = all[0]!.split('\t');
  if (head.length !== 2 || head[0] !== tag || !/^(0|[1-9][0-9]?)$/.test(head[1]!)) bad();
  const count = Number(head[1]);
  if (count > max || all.length !== count + 1) bad();
  return all.slice(1);
}

export function parseApps(text: string): CarApp[] {
  const ids = new Set<string>();
  return counted(text, 'APPS', 16).map(line => {
    const [id, version, sequence, running, ...rest] = line.split('\t');
    if (rest.length || !id || !ID.test(id) || ids.has(id) || !version || !VERSION.test(version)
      || !sequence || !isU64(sequence, true) || (running !== '0' && running !== '1')) bad();
    ids.add(id!);
    return { id: id!, version: version!, sequence: sequence!, running: running === '1' };
  });
}

export function parseSettingLine(line: string): Setting {
  const [key, label, value, list, ...rest] = line.split('|');
  const choices = (list ?? '').split(',');
  if (rest.length || !key || !KEY.test(key) || !label || !LABEL.test(label) || label.trim() !== label
    || choices.length > 6 || choices.some(c => !CHOICE.test(c)) || new Set(choices).size !== choices.length
    || !value || !choices.includes(value)) bad();
  return { key: key!, label: label!, value: value!, choices };
}

export function parseSettings(text: string): Setting[] {
  const settings = counted(text, 'SETTINGS', 12).map(parseSettingLine);
  if (new Set(settings.map(s => s.key)).size !== settings.length) bad();
  return settings;
}

export function parseStatus(text: string): Status {
  const all = lines(text, 2);
  const head = all[0]!.split('\t');
  const state = head[1] as StatusState;
  if (head.length !== 3 || head[0] !== 'STATUS' || !STATUS_STATES.includes(state)
    || !MESSAGE.test(head[2]!)) bad();
  const status: Status = { state, message: head[2]! };
  if (all.length === 2) {
    const car = all[1]!.split('\t');
    if (state !== 'paired' || car.length !== 3 || car[0] !== 'CAR' || !BSSID.test(car[1]!)
      || !isHostPort(car[2]!)) bad();
    status.car = { bssid: car[1]!, address: car[2]! };
  }
  return status;
}

export function parsePair(text: string): string {
  const head = lines(text, 1)[0]!.split('\t');
  if (head.length !== 3 || head[0] !== 'PAIR' || head[1] !== 'pending' || !/^[0-9]{6}$/.test(head[2]!)) bad();
  return head[2]!;
}

export function parseWake(text: string): WakeState {
  const head = lines(text, 1)[0]!.split('\t');
  const state = head[1] as WakeState;
  if (head.length !== 2 || head[0] !== 'WAKE' || !WAKE_STATES.includes(state)) bad();
  return state;
}

export function parseOk(text: string): void {
  if (text !== 'OK\n') bad();
}

/** A fixed error code from an error body, `ERR <code>`; anything else is not shown. */
export function errorCode(text: string): string {
  const m = /^ERR ([a-z0-9-]{1,32})\n$/.exec(text);
  return m ? m[1]! : 'unknown';
}
