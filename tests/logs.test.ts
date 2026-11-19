// SPDX-License-Identifier: MPL-2.0
import { randomBytes } from 'node:crypto';
import { clearAppLog, readAppLog, readSystemLog } from '../src/protocol/actions';
import { ProtocolError } from '../src/protocol/bytes';
import { TAIL_BYTES, logTail } from '../src/protocol/logTail';
import { CarError, CarSession, type Link, type LinkRequest, type LinkResponse } from '../src/protocol/session';
import { bodyDigest, canonicalText } from '../src/protocol/signing';
import { SoftwareKey, verifyWith } from './support/softwareKey';

const HOST = '172.16.222.1:8080';
const bytes = (text: string) => Uint8Array.from(Buffer.from(text, 'latin1'));

/** A listener whose log replies the link saves, as the native link does. */
class LogCar implements Link {
  seen: LinkRequest[] = [];
  constructor(readonly key: SoftwareKey, public reply: (r: LinkRequest) => LinkResponse) {}

  async request(r: LinkRequest): Promise<LinkResponse> {
    const nonce = randomBytes(32).toString('hex');
    if (r.route === '/v1/nonce') return { status: 200, nonce, body: 'NBT-REQ-1\n' };
    this.seen.push(r);
    const body = Buffer.from(r.body?.kind === 'text' ? r.body.text : '', 'ascii');
    const text = canonicalText(r.method, r.route, r.host, r.headers['X-NBT-Nonce']!, body.length, bodyDigest(body));
    if (!verifyWith(this.key.publicKey, text, r.headers['X-NBT-Signature']!)) return { status: 403, nonce, body: 'ERR auth\n' };
    return { ...this.reply(r), nonce };
  }
}

describe('car logs', () => {
  const key = new SoftwareKey();

  it('shows the end of a log as printable text, from a whole line', () => {
    expect(logTail(bytes('started\r\nbad \x01\xff byte\tok\n'))).toBe('started\nbad ?? byte\tok\n');
    const long = 'x'.repeat(TAIL_BYTES) + '\nlast line\n';
    expect(logTail(bytes('first\n' + long))).toBe('last line\n');
    expect(logTail(new Uint8Array())).toBe('');
  });

  it('asks for an application log, signed, and gets the saved file', async () => {
    const saved = { uri: 'file:///cache/car-logs/app-clock.log', size: 12, tail: 'hello\n' };
    const car = new LogCar(key, () => ({ status: 200, body: '', saved }));
    expect(await readAppLog(new CarSession(car, key, HOST), 'clock')).toEqual(saved);
    expect(car.seen[0]).toMatchObject({ route: '/v1/logs/app', method: 'POST', saveAs: 'app-clock',
      body: { kind: 'text', text: 'clock\n' } });
    await readSystemLog(new CarSession(car, key, HOST));
    expect(car.seen[1]).toMatchObject({ route: '/v1/logs/system', saveAs: 'idrive', body: { kind: 'text', text: '' } });
  });

  it('clears an application log with a signed request', async () => {
    const car = new LogCar(key, () => ({ status: 200, body: 'OK\n' }));
    await clearAppLog(new CarSession(car, key, HOST), 'clock');
    expect(car.seen[0]).toMatchObject({ route: '/v1/logs/clear', method: 'POST', body: { kind: 'text', text: 'clock\n' } });
    expect(car.seen[0]!.saveAs).toBeUndefined();
  });

  it('turns a refusal or a reply that was not saved into errors', async () => {
    const refused = new LogCar(key, () => ({ status: 409, body: 'ERR request\n' }));
    await expect(readSystemLog(new CarSession(refused, key, HOST))).rejects.toEqual(new CarError(409, 'request'));
    const unsaved = new LogCar(key, () => ({ status: 200, body: '' }));
    await expect(readSystemLog(new CarSession(unsaved, key, HOST))).rejects.toBeInstanceOf(ProtocolError);
    await expect(readAppLog(new CarSession(unsaved, key, HOST), '../x')).rejects.toBeInstanceOf(ProtocolError);
  });
});
