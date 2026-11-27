// SPDX-License-Identifier: MPL-2.0
/** The online catalog: bounded parsing, the release offered, downloads checked against it. */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CATALOG_URL, CatalogError, fetchCatalog, onlineUpdate, parseCatalog, releaseFor, type CatalogApp } from '../src/store/catalog';
import { downloadRelease } from '../src/store/download';

const files = new Map<string, string>();
const downloads: string[] = [];
let served = new Map<string, string>();
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
    static async downloadFileAsync(url: string, target: File, options: { onProgress?: (p: { bytesWritten: number }) => void }) {
      downloads.push(url);
      const content = served.get(url);
      if (content === undefined) throw new Error('404');
      options.onProgress?.({ bytesWritten: content.length });
      files.set(target.uri, content);
      return target;
    }
  }
  return { Directory, File, Paths: { document: 'doc:', cache: 'cache:' } };
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
  ...jest.requireActual('../src/protocol/packageHeader'),
  HEAD_READ: 64,
  parsePackageHead: (head: Uint8Array) => {
    const [app, version, sequence] = Buffer.from(head).toString().split(' ');
    return { app, version, sequence, compat: '', payloadSize: 0, payloadSha256: '', settings: [] };
  },
}));


const real = JSON.parse(readFileSync(join(__dirname, 'fixtures/catalog.json'), 'utf8')) as { apps: Record<string, unknown>[] };
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

function app(id: string, releases: { version: string; sequence: string; prerelease?: boolean; content?: string }[]) {
  return {
    id, name: id, summary: 's', repo: `NBTFoundry/nf-${id}`, license: 'MPL-2.0', category: 'game',
    releases: releases.map(r => {
      const content = r.content ?? `${id} ${r.version} ${r.sequence}`;
      const name = `${id}-${r.version}.nbt`;
      return { version: r.version, sequence: r.sequence, prerelease: !!r.prerelease, compat: 'x',
        files: [{ name, url: `https://github.com/NBTFoundry/nf-${id}/releases/download/v${r.version}/${name}`,
          size: content.length, sha256: sha(content), version: r.version, sequence: r.sequence }] };
    }),
  };
}
const catalogOf = (...apps: unknown[]) => parseCatalog({ schema: 1, generated: '2026-11-23T09:00:00Z', apps }, 1);

beforeEach(() => {
  files.clear();
  downloads.length = 0;
  served = new Map();
});

it('reads the published catalog', () => {
  const catalog = parseCatalog(real, 5);
  expect(catalog.apps.map(a => a.id)).toEqual(expect.arrayContaining(['manager', 'doom']));
  const manager = catalog.apps.find(a => a.id === 'manager')!;
  expect(manager.releases[0]!.files.map(f => f.name)).toEqual(['nbt-manager-0.3.1.nbtr']);
  expect(catalog.fetchedAt).toBe(5);
});

it('fetches the catalog past every cache', async () => {
  const fetched = jest.fn(async () => ({ ok: true, text: async () => JSON.stringify(real) }));
  const saved = global.fetch;
  global.fetch = fetched as unknown as typeof fetch;
  try {
    expect((await fetchCatalog(7)).fetchedAt).toBe(7);
  } finally {
    global.fetch = saved;
  }
  const [url, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${CATALOG_URL}?t=7`);
  expect(init.headers).toMatchObject({ 'Cache-Control': 'no-store' });
});

it('refuses another schema and leaves out a malformed application', () => {
  expect(() => parseCatalog({ ...real, schema: 2 }, 0)).toThrow(CatalogError);
  const elsewhere = app('doom', [{ version: '1.0.0', sequence: '1000000' }]);
  elsewhere.releases[0]!.files[0]!.url = 'https://example.com/doom-1.0.0.nbt';
  const otherRepo = app('snes9x', [{ version: '1.0.0', sequence: '1000000' }]);
  otherRepo.releases[0]!.files[0]!.url = 'https://github.com/someone/else/releases/download/v1.0.0/snes9x-1.0.0.nbt';
  const catalog = catalogOf(elsewhere, otherRepo, app('gauges', [{ version: '1.0.0', sequence: '1000000' }]));
  expect(catalog.apps.map(a => a.id)).toEqual(['gauges']);
});

it('offers the newest stable release, or the newest with betas', () => {
  const entry = catalogOf(app('doom', [{ version: '1.1.0', sequence: '1001000', prerelease: true },
    { version: '1.0.2', sequence: '1000002' }])).apps[0]!;
  expect(releaseFor(entry, false)?.version).toBe('1.0.2');
  expect(releaseFor(entry, true)?.version).toBe('1.1.0');
  const catalog = catalogOf(entry);
  const car = { id: 'doom', version: '1.0.2', sequence: '1000002', running: false };
  expect(onlineUpdate(catalog, car, false)).toBeUndefined();
  expect(onlineUpdate(catalog, car, true)?.version).toBe('1.1.0');
});

it('downloads a release into the library', async () => {
  const entry: CatalogApp = catalogOf(app('doom', [{ version: '1.0.2', sequence: '1000002' }])).apps[0]!;
  const file = entry.releases[0]!.files[0]!;
  served.set(file.url, 'doom 1.0.2 1000002');
  const result = await downloadRelease([], entry, entry.releases[0]!);
  expect(result.entries.map(e => e.info.version)).toEqual(['1.0.2']);
  expect(result.outcomes[0]!.outcome).toBe('added');
  expect([...files.keys()].filter(k => k.startsWith('cache:'))).toEqual([]);
});

it('refuses a download that does not match the catalog', async () => {
  const entry: CatalogApp = catalogOf(app('doom', [{ version: '1.0.2', sequence: '1000002' }])).apps[0]!;
  const file = entry.releases[0]!.files[0]!;
  served.set(file.url, 'doom 1.0.2 1000003');
  await expect(downloadRelease([], entry, entry.releases[0]!)).rejects.toEqual(new CatalogError('mismatch'));
  served.set(file.url, 'xxxx 1.0.2 1000002');
  await expect(downloadRelease([], entry, entry.releases[0]!)).rejects.toEqual(new CatalogError('mismatch'));
  served.delete(file.url);
  await expect(downloadRelease([], entry, entry.releases[0]!)).rejects.toEqual(new CatalogError('download'));
  expect([...files.keys()].filter(k => k.includes('library'))).toEqual([]);
});
