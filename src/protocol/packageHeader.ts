// SPDX-License-Identifier: MPL-2.0
/** The phone's own check of an `.nbt` file: header, lengths and manifest fields.
 * The car verifies the signature; until it has, these values are unverified. */
import { ProtocolError, fromAscii, isHex, isU64 } from './bytes';
import { RELEASE_MAGICS, parseReleaseHead } from './releaseHeader';
import { parseSettingLine, type Setting } from './replies';
import { permissionsOf } from './permissions';

export const HEADER_SIZE = 24;
export const MANIFEST_MAX = 2048;
export const SIGNATURE_SIZE = 384;
export const PAYLOAD_MAX = 64 * 1024 * 1024;
/** Bytes to read from the start of a file to check it: a package's header and
 * manifest, or a manager release's (whose manifest the car allows up to 4 KiB). */
export const HEAD_READ = 4096;

export type PackageInfo = {
  app: string;
  version: string;
  sequence: string;
  compat: string;
  payloadSize: number;
  payloadSha256: string;
  settings: Setting[];
  /** Information for people the package carries (`property=`, `text=` lines; the
   * manager's PROTOCOL.md, "Package information"); absent for a manager release
   * and in entries read before this version. */
  properties?: PackageProperty[];
  text?: string[];
  /** What it may do to the car (protocol/permissions.ts), from its `bridge-*`
   * lines; absent for a manager release and entries read before this version. */
  permissions?: number;
  /** A manager release's format (`NBTRLS<n>`); absent for an application package. */
  format?: number;
};

export type PackageProperty = { label: string; value: string };

const PRINTABLE = /^[\x20-\x7e]*$/;

/** A `property=` value, `<label>|<value>`, or undefined when malformed (the car
 * refuses such a package; the phone only leaves the line out). */
export function parsePropertyLine(text: string): PackageProperty | undefined {
  const bar = text.indexOf('|');
  const label = text.slice(0, bar), value = text.slice(bar + 1);
  const field = (s: string, max: number) => s.length >= 1 && s.length <= max && PRINTABLE.test(s)
    && !s.includes('|') && s.trim() === s;
  return bar > 0 && field(label, 24) && field(value, 64) ? { label, value } : undefined;
}

const bad = (): never => {
  throw new ProtocolError('bad-package');
};

const ORDER = ['app', 'package', 'version', 'sequence', 'platform', 'compat', 'size', 'sha256'];

/** An application package, or a manager release (`app` is then `manager`). */
export function parsePackageHead(head: Uint8Array, fileSize: number): PackageInfo {
  if (head.length < HEADER_SIZE) bad();
  const magic = fromAscii(head.subarray(0, 8));
  if (RELEASE_MAGICS.includes(magic)) return parseReleaseHead(head, fileSize);
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const manifestSize = view.getUint32(8);
  const signatureSize = view.getUint32(12);
  const high = view.getUint32(16);
  const payloadSize = view.getUint32(20);
  if (magic !== 'NBTMGR1\n' || !manifestSize || manifestSize > MANIFEST_MAX || signatureSize !== SIGNATURE_SIZE
    || high !== 0 || payloadSize < 52 || payloadSize > PAYLOAD_MAX
    || fileSize !== HEADER_SIZE + manifestSize + SIGNATURE_SIZE + payloadSize
    || head.length < HEADER_SIZE + manifestSize) bad();
  const text = fromAscii(head.subarray(HEADER_SIZE, HEADER_SIZE + manifestSize));
  if (!text.endsWith('\n')) bad();
  const lines = text.slice(0, -1).split('\n');
  const values = new Map<string, string>();
  ORDER.forEach((name, i) => {
    const line = lines[i] ?? '';
    if (!line.startsWith(name + '=')) bad();
    values.set(name, line.slice(name.length + 1));
  });
  const app = values.get('app')!;
  const version = values.get('version')!;
  const sequence = values.get('sequence')!;
  const compat = values.get('compat')!;
  if (!/^[a-z0-9_-]{1,48}$/.test(app) || app === 'manager' || !isHex(values.get('package')!, 16)
    || !/^[A-Za-z0-9._-]{1,48}$/.test(version) || !isU64(sequence)
    || values.get('platform') !== 'qnx6.5-armv7le' || !/^[a-z0-9._-]{1,48}$/.test(compat)
    || values.get('size') !== String(payloadSize) || !isHex(values.get('sha256')!, 32)) bad();
  const rest = lines.slice(ORDER.length);
  const settings = rest.filter(l => l.startsWith('setting=')).map(l => parseSettingLine(l.slice(8)));
  const properties = rest.filter(l => l.startsWith('property=')).slice(0, 8)
    .map(l => parsePropertyLine(l.slice(9))).filter((p): p is PackageProperty => p !== undefined);
  const textLines = rest.filter(l => l.startsWith('text=')).slice(0, 20).map(l => l.slice(5))
    .filter(l => l.length <= 120 && PRINTABLE.test(l));
  return { app, version, sequence, compat, payloadSize, payloadSha256: values.get('sha256')!, settings,
    properties, text: textLines, permissions: permissionsOf(rest) };
}
