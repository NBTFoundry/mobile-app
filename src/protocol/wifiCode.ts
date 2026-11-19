// SPDX-License-Identifier: MPL-2.0
/** The Wi-Fi code shown by Pair a phone: `WIFI:T:WPA;S:<ssid>;P:<passphrase>;;`. */
import { ProtocolError } from './bytes';

export type WifiCode = { ssid: string; passphrase: string };

/** Splits `K:value;` fields, honouring backslash escapes of `\ ; , : "`. */
function fields(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < body.length && body[i] !== ';') {
    const colon = body.indexOf(':', i);
    if (colon < 0) throw new ProtocolError('bad-wifi-code');
    const name = body.slice(i, colon);
    let value = '';
    let j = colon + 1;
    for (; j < body.length && body[j] !== ';'; j++) {
      if (body[j] === '\\') {
        j++;
        if (j >= body.length) throw new ProtocolError('bad-wifi-code');
      }
      value += body[j];
    }
    if (j >= body.length || !/^[A-Z]{1,2}$/.test(name) || out.has(name)) throw new ProtocolError('bad-wifi-code');
    out.set(name, value);
    i = j + 1;
  }
  if (body.slice(i) !== ';') throw new ProtocolError('bad-wifi-code');
  return out;
}

export function parseWifiCode(text: string): WifiCode {
  if (text.length > 256 || !text.startsWith('WIFI:') || !/^[\x20-\x7e]+$/.test(text)) {
    throw new ProtocolError('bad-wifi-code');
  }
  const f = fields(text.slice(5));
  const ssid = f.get('S') ?? '';
  const passphrase = f.get('P') ?? '';
  const type = f.get('T');
  if ((type !== 'WPA' && type !== 'WPA2') || ssid.length < 1 || ssid.length > 32
    || passphrase.length < 8 || passphrase.length > 63 || f.get('H') === 'true') {
    throw new ProtocolError('bad-wifi-code');
  }
  return { ssid, passphrase };
}
