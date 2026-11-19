/** Byte helpers shared by the protocol code. Inputs are untrusted and checked. */
export class ProtocolError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProtocolError';
  }
}

const HEX = '0123456789abcdef';

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += HEX[b >> 4]! + HEX[b & 15]!;
  return out;
}

/** Decodes lowercase hex of an exact byte length, or any even length when `size` is omitted. */
export function fromHex(text: string, size?: number): Uint8Array {
  if (text.length % 2 || (size !== undefined && text.length !== size * 2) || !/^[0-9a-f]*$/.test(text)) {
    throw new ProtocolError('bad-hex');
  }
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function isHex(text: string, size: number): boolean {
  return text.length === size * 2 && /^[0-9a-f]+$/.test(text);
}

/** Printable ASCII only; protocol text never carries other bytes. */
export function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 126 || (c < 32 && c !== 9 && c !== 10)) throw new ProtocolError('bad-text');
    out[i] = c;
  }
  return out;
}

export function fromAscii(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b > 126 || (b < 32 && b !== 9 && b !== 10)) throw new ProtocolError('bad-text');
    out += String.fromCharCode(b);
  }
  return out;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Canonical unsigned 64-bit decimal, kept as text so no precision is lost. */
export function isU64(text: string, allowZero = false): boolean {
  if (!/^(0|[1-9][0-9]{0,19})$/.test(text)) return false;
  if (!allowZero && text === '0') return false;
  return text.length < 20 || text <= '18446744073709551615';
}

/** Compares two canonical u64 decimal strings. */
export function compareU64(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}
