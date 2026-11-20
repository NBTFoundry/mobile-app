// SPDX-License-Identifier: MPL-2.0
/** NBT-REQ-1 request signing text, key ids and the pairing code (PROTOCOL.md, paired-phone HTTP). */
import { ProtocolError, ascii, concat, fromHex, isHex, toHex } from './bytes';
import { sha256 } from './sha256';

export type Method = 'GET' | 'POST';

export const ROUTES = ['/v1/nonce', '/v1/apps', '/v1/settings/read', '/v1/settings/set',
  '/v1/wake', '/v1/pair', '/v1/upload', '/v1/remove', '/v1/status', '/v1/logs/app', '/v1/logs/system',
  '/v1/logs/clear', '/v1/logs/manager', '/v1/files/list', '/v1/files/put', '/v1/files/data',
  '/v1/files/remove', '/v1/autostart'] as const;
export type Route = (typeof ROUTES)[number];

const GET_ROUTES: readonly Route[] = ['/v1/nonce', '/v1/apps', '/v1/status'];

export function methodFor(route: Route): Method {
  return GET_ROUTES.includes(route) ? 'GET' : 'POST';
}

/** `IPv4:port`, numeric, as the listener's Host header must be. */
export function isHostPort(text: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/.exec(text);
  if (!m) return false;
  const parts = m.slice(1, 5).map(Number);
  const port = Number(m[5]);
  return parts.every(p => p <= 255) && !m.slice(1, 6).some(p => p.length > 1 && p.startsWith('0'))
    && port > 0 && port <= 65535;
}

export function canonicalText(method: Method, route: Route, host: string, nonce: string,
  bodyLength: number, bodySha256: string): string {
  if (method !== methodFor(route) || !isHostPort(host) || !isHex(nonce, 32)
    || !Number.isSafeInteger(bodyLength) || bodyLength < 0 || !isHex(bodySha256, 32)
    || (method === 'GET' && bodyLength !== 0)) {
    throw new ProtocolError('bad-request');
  }
  return `NBT-REQ-1\n${method}\n${route}\n${host}\n${nonce}\n${bodyLength}\n${bodySha256}\n`;
}

export function bodyDigest(body: Uint8Array): string {
  return toHex(sha256(body));
}

export const EMPTY_SHA256 = bodyDigest(new Uint8Array(0));

export function checkPublicKey(publicKeyHex: string): Uint8Array {
  const key = fromHex(publicKeyHex, 65);
  if (key[0] !== 4) throw new ProtocolError('bad-key');
  return key;
}

export function keyId(publicKeyHex: string): string {
  return toHex(sha256(checkPublicKey(publicKeyHex)));
}

/** uint32_be(SHA256(nonce || public key)[0:4]) mod 1000000, six digits. */
export function pairingCode(nonce: string, publicKeyHex: string): string {
  const digest = sha256(concat(fromHex(nonce, 32), checkPublicKey(publicKeyHex)));
  const value = ((digest[0]! << 24) >>> 0) + (digest[1]! << 16) + (digest[2]! << 8) + digest[3]!;
  return String(value % 1000000).padStart(6, '0');
}

/** Phone names: printable ASCII 1-32, no tab or `|`, no leading or trailing space. */
export function cleanPhoneName(raw: string): string {
  const name = raw.replace(/[^\x20-\x7e]/g, '').replace(/\|/g, '').trim().slice(0, 32).trim();
  return name || 'Phone';
}

export function pairBody(name: string, publicKeyHex: string): Uint8Array {
  checkPublicKey(publicKeyHex);
  if (name !== cleanPhoneName(name)) throw new ProtocolError('bad-name');
  return ascii(`NBTPAIR1\nname=${name}\nkey=${publicKeyHex}\n`);
}
