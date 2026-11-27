// SPDX-License-Identifier: MPL-2.0
/**
 * The online catalog (NBTFoundry/NBTFoundry.github.io): applications and their signed releases on
 * GitHub, which the phone downloads into the library. Untrusted, bounded input: a file is only ever
 * fetched from its application's own GitHub releases, and the library and the car check it again.
 */
import { File, Paths } from 'expo-file-system';
import { compareU64, isHex, isU64 } from '../protocol/bytes';
import { parsePropertyLine, type PackageProperty } from '../protocol/packageHeader';
import type { CarApp } from '../protocol/replies';

export const CATALOG_URL = 'https://nbtfoundry.github.io/catalog.json';
const CATALOG_MAX = 1024 * 1024;
const FILE_MAX = 200 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
/** Older than this, opening Get apps reads the catalog again. */
export const CATALOG_FRESH_MS = 10 * 60_000;

export type CatalogFile = { name: string; url: string; size: number; sha256: string; version: string;
  sequence: string };
export type CatalogRelease = { version: string; sequence: string; prerelease: boolean; date?: number;
  page?: string; compat: string; bridge?: string; properties: PackageProperty[]; text: string[];
  /** What is new, from the release's page: "### Heading", "- item" or a sentence per line. */
  notes: string[]; files: CatalogFile[] };
export type CatalogApp = { id: string; name: string; summary: string; repo: string; license: string;
  category: string; releases: CatalogRelease[] };
export type Catalog = { generated: number; fetchedAt: number; apps: CatalogApp[] };

export class CatalogError extends Error {
  constructor(readonly code: 'offline' | 'bad-catalog' | 'download' | 'mismatch') {
    super(code);
    this.name = 'CatalogError';
  }
}

const PRINTABLE = /^[\x20-\x7e]*$/;
/** A line of release notes: any script, no control character. */
const NOTE_LINE = /^[^\x00-\x1f\x7f]{1,300}$/u;
const ID = /^[a-z0-9_-]{1,48}$/;
const VERSION = /^[A-Za-z0-9._-]{1,48}$/;
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const FILE_NAME = /^[A-Za-z0-9._-]{1,80}\.nbtr?$/;

const bad = (): never => {
  throw new CatalogError('bad-catalog');
};
const text = (value: unknown, max: number, min = 1): string =>
  typeof value === 'string' && value.length >= min && value.length <= max && PRINTABLE.test(value) ? value : bad();
const optional = <T>(value: unknown, read: (v: unknown) => T): T | undefined =>
  value === undefined || value === null ? undefined : read(value);
const time = (value: unknown): number => {
  const parsed = Date.parse(text(value, 40));
  return Number.isFinite(parsed) ? parsed : bad();
};
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : bad());

function parseFile(raw: unknown, repo: string, app: string): CatalogFile {
  const f = (raw ?? {}) as Record<string, unknown>;
  const name = text(f.name, 90);
  const url = text(f.url, 300);
  // Only a release download of the application's own repository.
  const prefix = `https://github.com/${repo}/releases/download/`;
  if (!FILE_NAME.test(name) || !url.startsWith(prefix) || !url.endsWith(`/${name}`)
    || url.slice(prefix.length).split('/').length !== 2) bad();
  if (name.endsWith('.nbtr') !== (app === 'manager')) bad();
  const size = typeof f.size === 'number' && Number.isInteger(f.size) && f.size > 0 && f.size <= FILE_MAX ? f.size : bad();
  const sha256 = typeof f.sha256 === 'string' && isHex(f.sha256, 32) ? f.sha256 : bad();
  const version = text(f.version, 48);
  const sequence = text(f.sequence, 20);
  if (!VERSION.test(version) || !isU64(sequence)) bad();
  return { name, url, size, sha256, version, sequence };
}

function parseRelease(raw: unknown, repo: string, app: string): CatalogRelease {
  const r = (raw ?? {}) as Record<string, unknown>;
  const version = text(r.version, 48);
  const sequence = text(r.sequence, 20);
  if (!VERSION.test(version) || !isU64(sequence) || typeof r.prerelease !== 'boolean') bad();
  const files = list(r.files, 1).map(f => parseFile(f, repo, app));
  if (files.length !== 1) bad();
  const page = optional(r.page, v => text(v, 300));
  return {
    version, sequence, prerelease: r.prerelease as boolean, files,
    date: optional(r.date, time),
    page: page?.startsWith(`https://github.com/${repo}/`) ? page : undefined,
    compat: text(r.compat, 48),
    bridge: optional(r.bridge, v => text(v, 8)),
    properties: list(r.properties ?? [], 8).flatMap(p => {
      const { label, value } = (p ?? {}) as Record<string, unknown>;
      const parsed = typeof label === 'string' && typeof value === 'string' ? parsePropertyLine(`${label}|${value}`) : undefined;
      return parsed ? [parsed] : [];
    }),
    text: list(r.text ?? [], 20).filter((l): l is string => typeof l === 'string' && l.length <= 120 && PRINTABLE.test(l)),
    notes: list(r.notes ?? [], 24).filter((l): l is string => typeof l === 'string' && NOTE_LINE.test(l)),
  };
}

export function parseCatalog(raw: unknown, fetchedAt: number): Catalog {
  const c = (raw ?? {}) as Record<string, unknown>;
  if (c.schema !== 1) bad();
  const seen = new Set<string>();
  const apps: CatalogApp[] = [];
  for (const item of list(c.apps, 100)) {
    try {
      const a = (item ?? {}) as Record<string, unknown>;
      const id = text(a.id, 48);
      const repo = text(a.repo, 140);
      if (!ID.test(id) || !REPO.test(repo) || seen.has(id)) bad();
      const releases = list(a.releases, 2).map(r => parseRelease(r, repo, id));
      apps.push({ id, repo, releases, name: text(a.name, 40), summary: text(a.summary, 160),
        license: text(a.license, 80), category: text(a.category, 20) });
      seen.add(id);
    } catch (error) {
      if (!(error instanceof CatalogError)) throw error;
      // One malformed application leaves the others listed.
    }
  }
  return { generated: time(c.generated), fetchedAt, apps };
}

/** The release to offer: the newest, or the newest stable one without betas. */
export function releaseFor(app: CatalogApp, betas: boolean): CatalogRelease | undefined {
  return [...app.releases].filter(r => betas || !r.prerelease)
    .sort((a, b) => compareU64(b.sequence, a.sequence))[0];
}

/** A newer release than the car runs, online. */
export function onlineUpdate(catalog: Catalog | undefined, app: CarApp, betas: boolean): CatalogRelease | undefined {
  const entry = catalog?.apps.find(a => a.id === app.id);
  const release = entry && releaseFor(entry, betas);
  return release && compareU64(release.sequence, app.sequence) > 0 ? release : undefined;
}

/** A catalog read longer ago does not say what is newest. */
export const CATALOG_CURRENT_MS = 24 * 3_600_000;

/** Whether the catalog can tell that nothing newer than `id`'s listed release exists:
 * read within a day, and listing a release of it. */
export function listsNewest(catalog: Catalog | undefined, id: string, now: number): boolean {
  return !!catalog && now - catalog.fetchedAt < CATALOG_CURRENT_MS
    && catalog.apps.some(a => a.id === id && a.releases.length > 0);
}

const cacheFile = () => new File(Paths.document, 'catalog.json');

/** The catalog read last time, if any. */
export async function loadCachedCatalog(): Promise<Catalog | undefined> {
  try {
    const file = cacheFile();
    if (!file.exists) return undefined;
    const stored = JSON.parse(await file.text()) as { fetchedAt?: unknown; catalog?: unknown };
    return parseCatalog(stored.catalog, typeof stored.fetchedAt === 'number' ? stored.fetchedAt : 0);
  } catch {
    return undefined;
  }
}

/** Reads the catalog over the phone's internet connection (not the car's Wi-Fi) and keeps it. */
export async function fetchCatalog(now = Date.now()): Promise<Catalog> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let body: string;
  try {
    // Pages lets clients keep the file 10 minutes: an unused query and no-store skip every cache.
    const response = await fetch(`${CATALOG_URL}?t=${now}`, {
      signal: abort.signal,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
    });
    if (!response.ok) throw new CatalogError('offline');
    body = await response.text();
  } catch (error) {
    throw error instanceof CatalogError ? error : new CatalogError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (body.length > CATALOG_MAX) throw new CatalogError('bad-catalog');
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new CatalogError('bad-catalog');
  }
  const catalog = parseCatalog(raw, now);
  try {
    await cacheFile().write(JSON.stringify({ fetchedAt: now, catalog: raw }));
  } catch {
    // Shown now; read again next time.
  }
  return catalog;
}
