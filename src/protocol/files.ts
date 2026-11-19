// SPDX-License-Identifier: MPL-2.0
/**
 * An application's files on the car: bridge 1.5 `files` (manager docs/files-bridge.md). The car
 * stores and deletes them with no prompt there; the phone asks before a delete.
 */
import { ProtocolError, isHex, isU64 } from './bytes';
import { MAX_REPLY, parseOk } from './replies';
import type { CarSession } from './session';

/** The most a phone may send; larger files come from a USB stick on the car. */
export const PHONE_FILE_MAX = 64 * 1024 * 1024;
export const FILE_NAME_MAX = 96;
const MAX_FILES = 512;
const PAGE = 20;

export type CarFile = { name: string; size: number };
/** Sizes are bytes; `free` is what the car's disk can still take. */
export type FileListing = {
  count: number; used: number; quota: number; largest: number; free: number;
  extensions: string[]; files: CarFile[];
};
export type LocalFile = { uri: string; size: number; sha256: string };

const bad = (): never => {
  throw new ProtocolError('bad-reply');
};

const FORBIDDEN = '/\\:*?"<>|';
const allowed = (c: string) => c.length === 1 && c >= ' ' && c <= '~' && !FORBIDDEN.includes(c);

/**
 * A name the car stores: 1-96 printable ASCII bytes without / \ : * ? " < > |, neither starting
 * nor ending with a dot or a space, with an extension after its last dot.
 */
export function isFileName(name: string): boolean {
  if (name.length < 1 || name.length > FILE_NAME_MAX || /^[. ]|[. ]$/.test(name)) return false;
  if (![...name].every(allowed)) return false;
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1;
}

/** The extension the car checks: after the last dot, in any case. */
export const extensionOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

/**
 * The name a picked file is stored under, as the car names files from a USB stick: each byte it
 * does not allow becomes `_`, dots and spaces go from both ends, and a long name is cut before
 * its extension. Undefined when no name with an extension is left.
 */
export function storedName(picked: string): string | undefined {
  let clean = '';
  for (const c of picked) {
    const point = c.codePointAt(0)!;
    clean += allowed(c) ? c : '_'.repeat(point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4);
  }
  clean = clean.replace(/^[. ]+/, '').replace(/[. ]+$/, '');
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return undefined;
  if (clean.length > FILE_NAME_MAX) {
    const extension = clean.slice(dot);
    if (extension.length >= FILE_NAME_MAX) return undefined;
    clean = clean.slice(0, FILE_NAME_MAX - extension.length) + extension;
  }
  return isFileName(clean) ? clean : undefined;
}

const bytes = (text: string | undefined): number => {
  if (text === undefined || !isU64(text, true)) bad();
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : bad();
};

/** One page of `/v1/files/list`: the folder's usage and up to 20 files named after `after`. */
export function parseFiles(text: string, after: string): FileListing & { more: boolean } {
  if (text.length > MAX_REPLY || !text.endsWith('\n')) bad();
  const all = text.slice(0, -1).split('\n');
  const head = all[0]!.split('\t');
  if (all.length > PAGE + 1 || head.length !== 8 || head[0] !== 'FILES' || !/^[01]$/.test(head[6]!)) bad();
  const extensions = head[7]!.split(',');
  if (extensions.length > 16 || extensions.some(e => !/^[a-z0-9]{1,8}$/.test(e))
    || new Set(extensions).size !== extensions.length) bad();
  let previous = after;
  const files = all.slice(1).map(line => {
    const [name, size, ...rest] = line.split('\t');
    // In byte order, after the last name the phone has.
    if (rest.length || !name || !isFileName(name) || name <= previous) bad();
    previous = name!;
    return { name: name!, size: bytes(size) };
  });
  const more = head[6] === '1';
  const listing = { count: bytes(head[1]), used: bytes(head[2]), quota: bytes(head[3]), largest: bytes(head[4]),
    free: bytes(head[5]), more, extensions, files };
  if (listing.count > MAX_FILES || (more && files.length !== PAGE)) bad();
  return listing;
}

/** Every file of an application, read a page at a time. */
export async function listFiles(session: CarSession, app: string): Promise<FileListing> {
  const files: CarFile[] = [];
  let after = '';
  for (let page = 0; page <= MAX_FILES / PAGE; page++) {
    const reply = parseFiles((await session.ok('/v1/files/list', { kind: 'text', text: `${app}\t${after}\n` })).body, after);
    files.push(...reply.files);
    if (!reply.more) {
      const { count, used, quota, largest, free, extensions } = reply;
      return { count, used, quota, largest, free, extensions, files };
    }
    after = files[files.length - 1]!.name;
  }
  return bad();
}

/** Announces a file, then sends its bytes, which must be the ones announced. */
export async function sendFile(session: CarSession, app: string, name: string, file: LocalFile,
  onProgress: (sent: number, total: number) => void): Promise<void> {
  if (!isFileName(name) || !isHex(file.sha256, 32) || !Number.isSafeInteger(file.size) || file.size <= 0
    || file.size > PHONE_FILE_MAX) {
    throw new ProtocolError('bad-request');
  }
  const announce = `${app}\t${name}\t${file.size}\t${file.sha256}\n`;
  parseOk((await session.ok('/v1/files/put', { kind: 'text', text: announce })).body);
  parseOk((await session.ok('/v1/files/data', { kind: 'file', ...file }, onProgress)).body);
}

/** Deletes a file at once. */
export async function removeFile(session: CarSession, app: string, name: string): Promise<void> {
  if (!isFileName(name)) throw new ProtocolError('bad-request');
  parseOk((await session.ok('/v1/files/remove', { kind: 'text', text: `${app}\t${name}\n` })).body);
}
