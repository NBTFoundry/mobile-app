// SPDX-License-Identifier: MPL-2.0
/** The library keeps one version per application: the newest. */
import { createHash } from 'crypto';
import { addPackage, loadLibrary, managerChoice, type LibraryEntry } from '../src/store/library';

const files = new Map<string, string>();
jest.mock('expo-file-system', () => {
  const join = (parent: { uri: string } | string, name: string) =>
    `${typeof parent === 'string' ? parent : parent.uri}/${name}`;
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name: string) { this.uri = join(parent, name); }
    get exists() { return true; }
    create() {}
  }
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      this.uri = name === undefined ? String(parent) : join(parent, name);
    }
    get exists() { return files.has(this.uri); }
    delete() { files.delete(this.uri); }
    async text() { return files.get(this.uri) ?? ''; }
    async write(text: string) { files.set(this.uri, text); }
    async move(target: File) {
      files.set(target.uri, files.get(this.uri) ?? '');
      files.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: 'doc:' } };
});
/** A test package's content is its manifest: "<app> <version> <sequence>". */
jest.mock('../modules/car-link', () => ({
  CarLink: {
    inspect: async (uri: string) => {
      const content = files.get(uri) ?? '';
      const sha256 = jest.requireActual('crypto').createHash('sha256').update(content).digest('hex');
      return { size: content.length, sha256, head: Buffer.from(content).toString('hex') };
    },
  },
}));
jest.mock('../src/protocol/packageHeader', () => ({
  HEAD_READ: 64,
  parsePackageHead: (head: Uint8Array) => {
    const [app, version, sequence, format] = Buffer.from(head).toString().split(' ');
    return { app, version, sequence, compat: '', payloadSize: 0, payloadSha256: '', settings: [],
      ...(format ? { format: Number(format) } : {}) };
  },
}));

const pick = (content: string) => {
  files.set(`cache:${content}`, content);
  return `cache:${content}`;
};
const stored = () => [...files.keys()].filter(uri => uri.startsWith('doc:/library/') && uri.endsWith('.nbt'));
const add = (entries: LibraryEntry[], content: string) => addPackage(entries, pick(content), `${content}.nbt`);

beforeEach(() => files.clear());

it('replaces an older version of the same application', async () => {
  const first = await add([], 'snes9x 1.0 5');
  const other = await add(first.entries, 'pcsx 0.1 3');
  const result = await add(other.entries, 'snes9x 1.1 6');
  expect(result.outcome).toBe('replaced');
  expect(result.other?.info.version).toBe('1.0');
  expect(result.entries.map(e => `${e.info.app} ${e.info.version}`)).toEqual(['snes9x 1.1', 'pcsx 0.1']);
  expect(stored()).toHaveLength(2);
  expect((await loadLibrary()).map(e => e.info.version)).toEqual(['1.1', '0.1']);
});

it('refuses an older version and keeps the newer one', async () => {
  const first = await add([], 'snes9x 1.1 6');
  const result = await add(first.entries, 'snes9x 1.0 5');
  expect(result.outcome).toBe('older');
  expect(result.other?.info.version).toBe('1.1');
  expect(result.entries).toBe(first.entries);
  expect(stored()).toHaveLength(1);
});

it('lets a different build of the same sequence replace the one held', async () => {
  const first = await add([], 'manager dev1 7');
  const result = await add(first.entries, 'manager dev1b 7');
  expect(result.outcome).toBe('replaced');
  expect(result.entries.map(e => e.info.version)).toEqual(['dev1b']);
});

it('reports a package already held', async () => {
  const first = await add([], 'pcsx 0.1 3');
  expect((await add(first.entries, 'pcsx 0.1 3')).outcome).toBe('already');
});

it('keeps the newest of each application from an older library', async () => {
  const contents = ['pcsx 0.1 3', 'pcsx 0.2 4', 'doom 1 1'];
  const index = [];
  for (const content of contents) {
    const sha256 = createHash('sha256').update(content).digest('hex');
    files.set(`doc:/library/${sha256}.nbt`, content);
    index.push({ sha256, fileName: 'x.nbt', addedAt: 1 });
  }
  files.set('doc:/library/index.json', JSON.stringify(index));
  expect((await loadLibrary()).map(e => e.info.version)).toEqual(['0.2', '1']);
  expect(stored()).toHaveLength(2);
  expect(JSON.parse(files.get('doc:/library/index.json')!)).toHaveLength(2);
});


it('keeps one manager release, the newest', async () => {
  const old = await add([], 'manager dev125 125 2');
  const next = await add(old.entries, 'manager dev126 126 3');
  expect(next.outcome).toBe('replaced');
  expect(next.entries.map(e => e.info.version)).toEqual(['dev126']);
  expect(stored()).toHaveLength(1);
});

describe('managerChoice', () => {
  const entry = (version: string, sequence: string, format: number, addedAt = 0): LibraryEntry => ({
    sha256: version.padEnd(64, '0'), fileName: `${version}.nbtr`, size: 1, addedAt,
    info: { app: 'manager', version, sequence, compat: '', payloadSize: 0, payloadSha256: '', settings: [], format },
  });
  const full = entry('dev126', '126', 3);
  const car = { version: 'dev123', sequence: '123', formats: [1, 2, 3] };

  it('sends the newest release when the car reads its format', () => {
    expect(managerChoice([entry('dev120', '120', 2), full], car)).toEqual({ next: full });
  });
  it('says when the car does not read its format', () => {
    expect(managerChoice([full], null)).toEqual({ unreadable: full });
    expect(managerChoice([full], { ...car, formats: [1, 2] })).toEqual({ unreadable: full });
  });
  it('offers nothing when the car runs it or newer', () => {
    expect(managerChoice([full], { ...car, version: 'dev126', sequence: '126' })).toEqual({});
    expect(managerChoice([], car)).toEqual({});
  });
  it('offers the newest when the car is unknown', () => {
    expect(managerChoice([full], undefined)).toEqual({ next: full });
  });
});
