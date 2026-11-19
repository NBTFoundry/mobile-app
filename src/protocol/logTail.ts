/**
 * The end of a saved log as printable text, which the phone shows while the whole file is
 * shared as it came. The native link computes the same (CarLog.kt).
 */
export const TAIL_BYTES = 16 * 1024;

/** The last TAIL_BYTES of `bytes`, from a whole line; tabs and newlines kept, CR dropped, other bytes `?`. */
export function logTail(bytes: Uint8Array): string {
  let start = Math.max(0, bytes.length - TAIL_BYTES);
  if (start > 0) {
    const newline = bytes.indexOf(0x0a, start);
    start = newline < 0 ? start : newline + 1;
  }
  let out = '';
  for (let i = start; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0x0d) continue;
    out += b === 0x0a || b === 0x09 || (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '?';
  }
  return out;
}
