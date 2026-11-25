// SPDX-License-Identifier: MPL-2.0
import { createHash, generateKeyPairSync } from 'node:crypto';
import { cleanKeyName, DeveloperKeyError, fingerprint, keyAddBody, readDeveloperKey } from '../src/protocol/developerKey';
import { parseKeys, parseStatus } from '../src/protocol/replies';

const rsa = (bits: number, publicExponent = 65537) =>
  generateKeyPairSync('rsa', { modulusLength: bits, publicExponent });
const strong = rsa(3072);
const pem = strong.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const der = strong.publicKey.export({ type: 'spki', format: 'der' });
const id = createHash('sha256').update(der).digest('hex');

const problem = (text: string) => {
  try {
    readDeveloperKey(text);
  } catch (error) {
    return error instanceof DeveloperKeyError ? error.code : 'other';
  }
  return 'none';
};

describe('developer keys', () => {
  it('reads an RSA-3072 public key and names it as the car does', () => {
    const key = readDeveloperKey(`# my key\n${pem}\n`);
    expect(Buffer.from(key.der)).toEqual(der);
    expect(key.id).toBe(id);
    expect(key.fingerprint).toBe(`${id.slice(0, 4)} ${id.slice(4, 8)} ${id.slice(8, 12)} ${id.slice(12, 16)}`);
    expect(fingerprint(id)).toBe(key.fingerprint);
    expect(keyAddBody('Alice', key)).toBe(`NBTKEY1\nname=Alice\nkey=${der.toString('hex')}\n`);
  });

  it('never reads a private key, even with the public key beside it', () => {
    const privatePem = strong.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const rsaPem = strong.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string;
    expect(problem(privatePem)).toBe('private-key');
    expect(problem(rsaPem)).toBe('private-key');
    expect(problem(`${pem}\n${privatePem}`)).toBe('private-key');
  });

  it('refuses other keys and other files', () => {
    expect(problem(rsa(2048).publicKey.export({ type: 'spki', format: 'pem' }) as string)).toBe('not-rsa-3072');
    expect(problem(rsa(3072, 3).publicKey.export({ type: 'spki', format: 'pem' }) as string)).toBe('not-rsa-3072');
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ type: 'spki', format: 'pem' });
    expect(problem(ec as string)).toBe('not-rsa-3072');
    expect(problem(strong.publicKey.export({ type: 'pkcs1', format: 'pem' }) as string)).toBe('not-public-key');
    expect(problem('hello')).toBe('not-public-key');
    expect(problem(pem.replace('KEY-----\nMII', 'KEY-----\n!II'))).toBe('not-public-key');
    expect(problem(pem.replace('KEY-----\nMII', 'KEY-----\nMIJ'))).toBe('not-rsa-3072');
    expect(problem(pem + ' '.repeat(20000))).toBe('not-public-key');
  });

  it('cleans key names to the phone name rules', () => {
    expect(cleanKeyName('alice.pem')).toBe('Alice'.toLowerCase());
    expect(cleanKeyName('  my|key\t.pub')).toBe('mykey');
    expect(cleanKeyName('é.pem')).toBe('Developer');
    expect(cleanKeyName('x'.repeat(40))).toHaveLength(32);
  });

  it('parses the car’s key list and the key statuses', () => {
    const other = 'b'.repeat(64);
    expect(parseKeys(`KEYS\t2\n${id}\tAlice Dev\t1764000000\n${other}\tBob\t1\n`)).toEqual([
      { id, name: 'Alice Dev', added: 1764000000 }, { id: other, name: 'Bob', added: 1 }]);
    expect(parseKeys('KEYS\t0\n')).toEqual([]);
    for (const bad of [`KEYS\t1\n${id}\tAlice\t0\n`, `KEYS\t1\n${id.toUpperCase()}\tAlice\t1\n`,
      `KEYS\t1\n${id}\t Alice\t1\n`, `KEYS\t1\n${id}\tA|B\t1\n`, `KEYS\t2\n${id}\tA\t1\n${id}\tB\t1\n`,
      `KEYS\t9\n`, `KEYS\t1\n${id}\tAlice\t1\textra\n`]) {
      expect(() => parseKeys(bad)).toThrow();
    }
    expect(parseStatus('STATUS\tkey-added\tDeveloper key added\n').state).toBe('key-added');
    expect(parseStatus('STATUS\tkey-removed\tDeveloper key removed\n').state).toBe('key-removed');
  });
});
