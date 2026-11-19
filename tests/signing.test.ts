import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromHex, toHex, ascii, isU64, compareU64 } from '../src/protocol/bytes';
import { sha256 } from '../src/protocol/sha256';
import { bodyDigest, canonicalText, cleanPhoneName, isHostPort, keyId, pairBody, pairingCode,
  type Method, type Route } from '../src/protocol/signing';

const VECTORS = path.join(__dirname, '../third_party/nbt-apps-manager/tests/phone-signing-vectors.tsv');
const SPKI_P256 = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');

const rows = readFileSync(VECTORS, 'ascii').split('\n')
  .filter(line => line && !line.startsWith('#'))
  .map(line => {
    const [method, route, host, nonce, body, publicKey, signature, requestSha, code, id] = line.split('\t');
    return { method: method as Method, route: route as Route, host: host!, nonce: nonce!, body: body!,
      publicKey: publicKey!, signature: signature!, requestSha: requestSha!, code: code!, id: id! };
  });

describe('shared signing vectors', () => {
  it('has vectors to check', () => expect(rows.length).toBeGreaterThanOrEqual(4));

  it.each(rows)('$method $route', row => {
    const body = fromHex(row.body);
    const text = canonicalText(row.method, row.route, row.host, row.nonce, body.length, bodyDigest(body));
    expect(toHex(sha256(ascii(text)))).toBe(row.requestSha);
    expect(keyId(row.publicKey)).toBe(row.id);
    expect(pairingCode(row.nonce, row.publicKey)).toBe(row.code);
    const key = createPublicKey({ key: Buffer.concat([SPKI_P256, Buffer.from(row.publicKey, 'hex')]),
      format: 'der', type: 'spki' });
    expect(verify('sha256', Buffer.from(text, 'ascii'), key, Buffer.from(row.signature, 'hex'))).toBe(true);
  });
});

describe('sha256', () => {
  it.each([0, 1, 55, 56, 63, 64, 65, 1000])('matches node for %i bytes', size => {
    const data = randomBytes(size);
    expect(toHex(sha256(data))).toBe(createHash('sha256').update(data).digest('hex'));
  });
});

describe('request text', () => {
  const nonce = '01'.repeat(32);
  it('rejects a wrong method, a body on GET and malformed hosts', () => {
    expect(() => canonicalText('POST', '/v1/apps', '172.16.222.1:8080', nonce, 0, bodyDigest(new Uint8Array()))).toThrow();
    expect(() => canonicalText('GET', '/v1/apps', '172.16.222.1:8080', nonce, 1, bodyDigest(new Uint8Array()))).toThrow();
    expect(() => canonicalText('GET', '/v1/apps', 'car:8080', nonce, 0, bodyDigest(new Uint8Array()))).toThrow();
    expect(() => canonicalText('GET', '/v1/apps', '172.16.222.1:8080', 'AB'.repeat(32), 0, bodyDigest(new Uint8Array()))).toThrow();
  });
  it('accepts only numeric IPv4 with a port', () => {
    expect(isHostPort('127.0.0.1:41234')).toBe(true);
    expect(isHostPort('172.16.222.01:8080')).toBe(false);
    expect(isHostPort('256.1.1.1:80')).toBe(false);
    expect(isHostPort('1.1.1.1:0')).toBe(false);
  });
});

describe('pairing body and names', () => {
  const key = rows[0]!.publicKey;
  it('builds the exact ordered body', () => {
    expect(Buffer.from(pairBody('Pixel', key)).toString()).toBe(`NBTPAIR1\nname=Pixel\nkey=${key}\n`);
  });
  it('cleans names to the car rules', () => {
    expect(cleanPhoneName('  Pixel|8 Pro ')).toBe('Pixel8 Pro');
    expect(cleanPhoneName('Téléphone')).toBe('Tlphone');
    expect(cleanPhoneName('x'.repeat(40))).toHaveLength(32);
    expect(cleanPhoneName('   ')).toBe('Phone');
    expect(() => pairBody(' bad', key)).toThrow();
  });
  it('rejects a compressed or short key', () => {
    expect(() => keyId('02' + '00'.repeat(64))).toThrow();
    expect(() => keyId('04')).toThrow();
  });
});

describe('u64 text', () => {
  it('keeps sequences exact', () => {
    expect(isU64('18446744073709551615')).toBe(true);
    expect(isU64('18446744073709551616')).toBe(false);
    expect(isU64('012')).toBe(false);
    expect(isU64('0')).toBe(false);
    expect(isU64('0', true)).toBe(true);
    expect(compareU64('9007199254740993', '9007199254740992')).toBe(1);
    expect(compareU64('10', '9')).toBe(1);
  });
});
