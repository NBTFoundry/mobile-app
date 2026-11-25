// SPDX-License-Identifier: MPL-2.0
/** Developer keys (PROTOCOL.md, "Developer keys"): an RSA-3072 public key read from a PEM file,
 * sent to the car as DER in hex. The car checks it again; the phone refuses early, and never
 * sends anything from a file that holds a private key. */
import { toHex } from './bytes';
import { sha256 } from './sha256';

export type DeveloperKeyProblem = 'private-key' | 'not-public-key' | 'not-rsa-3072';

export class DeveloperKeyError extends Error {
  constructor(readonly code: DeveloperKeyProblem) {
    super(code);
    this.name = 'DeveloperKeyError';
  }
}

export type DeveloperKey = { der: Uint8Array; id: string; fingerprint: string };

/** A PEM file is a few hundred bytes; anything much larger is not a key. */
export const MAX_KEY_FILE = 16384;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(text: string): Uint8Array | undefined {
  const clean = text.replace(/\s+/g, '');
  if (!clean || clean.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return undefined;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const quad = [...clean.slice(i, i + 4)].map(c => (c === '=' ? 0 : B64.indexOf(c)));
    const n = (quad[0]! << 18) | (quad[1]! << 12) | (quad[2]! << 6) | quad[3]!;
    out.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return new Uint8Array(out.slice(0, out.length - pad));
}

/** One DER element at `at`: its tag, where its contents start and end; undefined if malformed. */
function element(der: Uint8Array, at: number): { tag: number; start: number; end: number } | undefined {
  if (at + 2 > der.length) return undefined;
  const tag = der[at]!;
  let length = der[at + 1]!;
  let start = at + 2;
  if (length & 0x80) {
    const bytes = length & 0x7f;
    if (bytes < 1 || bytes > 2 || start + bytes > der.length || der[start] === 0) return undefined;
    length = 0;
    for (let i = 0; i < bytes; i++) length = (length << 8) | der[start + i]!;
    if (length < 128) return undefined;
    start += bytes;
  }
  return start + length <= der.length ? { tag, start, end: start + length } : undefined;
}

const RSA_ALGORITHM = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

/** SubjectPublicKeyInfo { rsaEncryption, BIT STRING { RSAPublicKey { n (3072 bits), e = 65537 } } }. */
function isRsa3072(der: Uint8Array): boolean {
  const spki = element(der, 0);
  if (!spki || spki.tag !== 0x30 || spki.end !== der.length) return false;
  const algorithm = der.slice(spki.start, spki.start + RSA_ALGORITHM.length);
  if (algorithm.length !== RSA_ALGORITHM.length || algorithm.some((b, i) => b !== RSA_ALGORITHM[i])) return false;
  const bits = element(der, spki.start + RSA_ALGORITHM.length);
  if (!bits || bits.tag !== 0x03 || bits.end !== spki.end || der[bits.start] !== 0) return false;
  const key = element(der, bits.start + 1);
  if (!key || key.tag !== 0x30 || key.end !== bits.end) return false;
  const n = element(der, key.start);
  if (!n || n.tag !== 0x02) return false;
  const e = element(der, n.end);
  if (!e || e.tag !== 0x02 || e.end !== key.end) return false;
  const modulus = der.slice(n.start, n.end);
  const exponent = der.slice(e.start, e.end);
  return modulus.length === 385 && modulus[0] === 0 && (modulus[1]! & 0x80) !== 0
    && exponent.length === 3 && exponent[0] === 1 && exponent[1] === 0 && exponent[2] === 1;
}

/** "abcd ef01 2345 6789": the key id's first 16 digits, as the car shows them. */
export const fingerprint = (id: string) => id.slice(0, 16).replace(/(.{4})(?!$)/g, '$1 ');

/** The public key in a PEM file (`openssl pkey -pubout`). A private key is refused outright. */
export function readDeveloperKey(pem: string): DeveloperKey {
  if (pem.length > MAX_KEY_FILE) throw new DeveloperKeyError('not-public-key');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(pem)) throw new DeveloperKeyError('private-key');
  const m = /-----BEGIN PUBLIC KEY-----([A-Za-z0-9+/=\s]+)-----END PUBLIC KEY-----/.exec(pem);
  const der = m ? base64(m[1]!) : undefined;
  if (!der) throw new DeveloperKeyError('not-public-key');
  if (der.length > 600 || !isRsa3072(der)) throw new DeveloperKeyError('not-rsa-3072');
  const id = toHex(sha256(der));
  return { der, id, fingerprint: fingerprint(id) };
}

/** A key's name, under the phone name rules (printable ASCII 1-32, no tab or `|`). */
export function cleanKeyName(raw: string): string {
  const name = raw.replace(/\.(pem|pub|txt)$/i, '').replace(/[^\x20-\x7e]/g, '').replace(/\|/g, '')
    .trim().slice(0, 32).trim();
  return name || 'Developer';
}

export function keyAddBody(name: string, key: DeveloperKey): string {
  return `NBTKEY1\nname=${cleanKeyName(name)}\nkey=${toHex(key.der)}\n`;
}
