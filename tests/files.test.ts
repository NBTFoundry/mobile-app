// SPDX-License-Identifier: MPL-2.0
import { createHash, randomBytes } from 'node:crypto';
import { ProtocolError } from '../src/protocol/bytes';
import { PHONE_FILE_MAX, extensionOf, isFileName, listFiles, parseFiles, removeFile, sendFile,
  storedName } from '../src/protocol/files';
import { CarError, CarSession, type Link, type LinkRequest, type LinkResponse } from '../src/protocol/session';
import { bodyDigest, canonicalText } from '../src/protocol/signing';
import { SoftwareKey, verifyWith } from './support/softwareKey';

const HOST = '172.16.222.1:8080';
const head = (count: number, more: number, extensions = 'sfc,smc') =>
  `FILES\t${count}\t${count * 1000}\t1073741824\t16777216\t5000000000\t${more}\t${extensions}\n`;

/** A worker that checks every signature, a file body's against the bytes behind its uri. */
class FilesCar implements Link {
  seen: LinkRequest[] = [];
  contents = new Map<string, Buffer>();
  constructor(readonly key: SoftwareKey, public reply: (r: LinkRequest) => LinkResponse) {}

  async request(r: LinkRequest): Promise<LinkResponse> {
    const nonce = randomBytes(32).toString('hex');
    if (r.route === '/v1/nonce') return { status: 200, nonce, body: 'NBT-REQ-1\n' };
    this.seen.push(r);
    const body = r.body?.kind === 'file' ? this.contents.get(r.body.uri)!
      : Buffer.from(r.body?.kind === 'text' ? r.body.text : '', 'ascii');
    const text = canonicalText(r.method, r.route, r.host, r.headers['X-NBT-Nonce']!, body.length, bodyDigest(body));
    if (!verifyWith(this.key.publicKey, text, r.headers['X-NBT-Signature']!)) return { status: 403, nonce, body: 'ERR auth\n' };
    return { ...this.reply(r), nonce };
  }
}

describe('file names', () => {
  it('accepts what the car stores and nothing else', () => {
    for (const name of ['Game.sfc', 'a.b', 'Super Game (E) [!].SMC', 'x'.repeat(92) + '.sfc']) {
      expect([name, isFileName(name)]).toEqual([name, true]);
    }
    for (const name of ['', '.sfc', 'game', 'game.', ' game.sfc', 'game.sfc ', 'a/b.sfc', 'a\\b.sfc', 'a:b.sfc',
      'a*b.sfc', 'a?b.sfc', 'a"b.sfc', 'a<b.sfc', 'a>b.sfc', 'a|b.sfc', 'tab\t.sfc', 'été.sfc', 'x'.repeat(93) + '.sfc']) {
      expect([name, isFileName(name)]).toEqual([name, false]);
    }
    expect(extensionOf('Game.Final.SFC')).toBe('sfc');
  });

  it('names a picked file as the car names one from a USB stick', () => {
    expect(storedName('Game.sfc')).toBe('Game.sfc');
    // Each UTF-8 byte the car does not allow becomes one underscore.
    expect(storedName('été: 2?.sfc')).toBe('__t___ 2_.sfc');
    expect(storedName('..  hidden.smc. ')).toBe('hidden.smc');
    expect(storedName('😀.sfc')).toBe('____.sfc');
    const long = storedName('y'.repeat(200) + '.sfc')!;
    expect([long.length, long.endsWith('yyy.sfc')]).toEqual([96, true]);
    expect(storedName('no extension')).toBeUndefined();
    expect(storedName('...')).toBeUndefined();
    expect(storedName('a.' + 'e'.repeat(120))).toBeUndefined();
  });
});

describe('file listings', () => {
  it('reads the folder’s usage and its files in byte order', () => {
    const listing = parseFiles(head(2, 0) + 'B.sfc\t1024\na.smc\t0\n', '');
    expect(listing).toEqual({ count: 2, used: 2000, quota: 1073741824, largest: 16777216, free: 5000000000,
      more: false, extensions: ['sfc', 'smc'], files: [{ name: 'B.sfc', size: 1024 }, { name: 'a.smc', size: 0 }] });
  });

  it('refuses a malformed, unordered or unbounded reply', () => {
    const bad = [
      head(0, 0).slice(0, -1),
      'FILE\t0\t0\t1\t1\t0\t0\tsfc\n',
      head(0, 2),
      head(0, 0, 'SFC'),
      head(0, 0, 'sfc,sfc'),
      head(0, 0, ''),
      head(513, 0),
      head(1, 0) + 'b.sfc\t1\na.sfc\t1\n',
      head(1, 0) + 'a.sfc\t1\na.sfc\t1\n',
      head(1, 0) + '.sfc\t1\n',
      head(1, 0) + 'a.sfc\t-1\n',
      head(1, 0) + 'a.sfc\t1\textra\n',
      head(1, 0) + 'a.sfc\t99999999999999999999\n',
      head(1, 1) + 'a.sfc\t1\n',
      head(30, 0) + Array.from({ length: 21 }, (_, i) => `f${String(i).padStart(2, '0')}.sfc\t1\n`).join(''),
    ];
    for (const text of bad) expect(() => parseFiles(text, '')).toThrow(ProtocolError);
    expect(() => parseFiles(head(1, 0) + 'a.sfc\t1\n', 'b.sfc')).toThrow(ProtocolError);
  });

  it('reads every page, each after the last name', async () => {
    const key = new SoftwareKey();
    const names = Array.from({ length: 45 }, (_, i) => `game${String(i).padStart(2, '0')}.sfc`);
    const car = new FilesCar(key, r => {
      const after = (r.body as { text: string }).text.split('\t')[1]!.trim();
      const rest = names.filter(n => n > after);
      const page = rest.slice(0, 20);
      return { status: 200, body: head(45, rest.length > 20 ? 1 : 0) + page.map(n => `${n}\t7\n`).join('') };
    });
    const listing = await listFiles(new CarSession(car, key, HOST), 'snes');
    expect(listing.files.map(f => f.name)).toEqual(names);
    expect(car.seen.map(r => (r.body as { text: string }).text))
      .toEqual(['snes\t\n', 'snes\tgame19.sfc\n', 'snes\tgame39.sfc\n']);
    expect(car.seen.every(r => r.route === '/v1/files/list' && r.method === 'POST')).toBe(true);
  });

  it('stops on a page that claims more but repeats itself', async () => {
    const key = new SoftwareKey();
    const page = Array.from({ length: 20 }, (_, i) => `g${String(i).padStart(2, '0')}.sfc\t1\n`).join('');
    const car = new FilesCar(key, () => ({ status: 200, body: head(100, 1) + page }));
    await expect(listFiles(new CarSession(car, key, HOST), 'snes')).rejects.toBeInstanceOf(ProtocolError);
    expect(car.seen).toHaveLength(2);
  });
});

describe('sending and deleting files', () => {
  const key = new SoftwareKey();

  it('announces a file, then sends exactly its bytes, both signed', async () => {
    const car = new FilesCar(key, () => ({ status: 200, body: 'OK\n' }));
    const bytes = randomBytes(3000);
    car.contents.set('file:///cache/game.sfc', bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await sendFile(new CarSession(car, key, HOST), 'snes', 'Game.sfc', { uri: 'file:///cache/game.sfc', size: 3000, sha256 },
      () => undefined);
    expect(car.seen[0]).toMatchObject({ route: '/v1/files/put', body: { kind: 'text', text: `snes\tGame.sfc\t3000\t${sha256}\n` } });
    expect(car.seen[1]).toMatchObject({ route: '/v1/files/data', body: { kind: 'file', uri: 'file:///cache/game.sfc', size: 3000 } });
  });

  it('sends no bytes when the car refuses the announcement', async () => {
    const car = new FilesCar(key, () => ({ status: 413, body: 'ERR quota\n' }));
    car.contents.set('file:///cache/g.sfc', Buffer.from('x'));
    const sha256 = createHash('sha256').update('x').digest('hex');
    await expect(sendFile(new CarSession(car, key, HOST), 'snes', 'g.sfc', { uri: 'file:///cache/g.sfc', size: 1, sha256 },
      () => undefined)).rejects.toEqual(new CarError(413, 'quota'));
    expect(car.seen).toHaveLength(1);
  });

  it('refuses to announce what the car would refuse', async () => {
    const car = new FilesCar(key, () => ({ status: 200, body: 'OK\n' }));
    const session = new CarSession(car, key, HOST);
    const sha256 = '0'.repeat(64);
    for (const [name, size] of [['g.sfc', PHONE_FILE_MAX + 1], ['g.sfc', 0], ['../g.sfc', 1], ['g', 1]] as const) {
      await expect(sendFile(session, 'snes', name, { uri: 'file:///x', size, sha256 }, () => undefined))
        .rejects.toBeInstanceOf(ProtocolError);
    }
    await expect(removeFile(session, 'snes', 'a/b.sfc')).rejects.toBeInstanceOf(ProtocolError);
    expect(car.seen).toHaveLength(0);
  });

  it('deletes a file with a signed request', async () => {
    const car = new FilesCar(key, () => ({ status: 200, body: 'OK\n' }));
    await removeFile(new CarSession(car, key, HOST), 'snes', 'Game.sfc');
    expect(car.seen[0]).toMatchObject({ route: '/v1/files/remove', body: { kind: 'text', text: 'snes\tGame.sfc\n' } });
  });
});
