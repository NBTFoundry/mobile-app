// SPDX-License-Identifier: MPL-2.0
/** Package files copied into the app's storage, indexed by their manifest. Shared by all cars. */
import { Directory, File, Paths } from 'expo-file-system';
import { CarLink } from '../../modules/car-link';
import { compareU64, fromHex } from '../protocol/bytes';
import { HEAD_READ, parsePackageHead, type PackageInfo } from '../protocol/packageHeader';
import type { CarApp, CarManager } from '../protocol/replies';

export type LibraryEntry = {
  sha256: string;
  fileName: string;
  size: number;
  addedAt: number;
  /** From the manifest; unverified until a car has verified the package. */
  info: PackageInfo;
};

const dir = () => new Directory(Paths.document, 'library');
const indexFile = () => new File(dir(), 'index.json');
export const packageFile = (sha256: string) => new File(dir(), `${sha256}.nbt`);

export class LibraryError extends Error {
  constructor(readonly code: 'not-a-package' | 'unreadable' | 'storage') {
    super(code);
    this.name = 'LibraryError';
  }
}

/** Reads a file the app can access and checks its header. */
export async function inspectPackage(uri: string): Promise<{ size: number; sha256: string; info: PackageInfo }> {
  let inspected;
  try {
    inspected = await CarLink.inspect(uri, HEAD_READ);
  } catch {
    throw new LibraryError('unreadable');
  }
  try {
    return { size: inspected.size, sha256: inspected.sha256,
      info: parsePackageHead(fromHex(inspected.head), inspected.size) };
  } catch {
    throw new LibraryError('not-a-package');
  }
}

export async function loadLibrary(): Promise<LibraryEntry[]> {
  try {
    const file = indexFile();
    if (!file.exists) return [];
    const raw = JSON.parse(await file.text()) as unknown;
    if (!Array.isArray(raw)) return [];
    const entries: LibraryEntry[] = [];
    for (const item of raw.slice(0, 200) as Partial<LibraryEntry>[]) {
      if (typeof item?.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.sha256)
        || typeof item.fileName !== 'string' || typeof item.addedAt !== 'number') continue;
      const stored = packageFile(item.sha256);
      if (!stored.exists) continue;
      try {
        const checked = await inspectPackage(stored.uri);
        if (checked.sha256 !== item.sha256) continue;
        entries.push({ sha256: item.sha256, fileName: item.fileName.slice(0, 80), size: checked.size,
          addedAt: item.addedAt, info: checked.info });
      } catch {
        continue;
      }
    }
    return await keepNewest(entries);
  } catch {
    return [];
  }
}

/** What one library place holds: an application, or the manager's releases of one format, so
 * that a step release stays beside the release it leads to (the manager's
 * docs/manager-release.md, "Step releases"). */
function placeOf(info: PackageInfo): string {
  return info.app === 'manager' ? `manager/${info.format ?? 1}` : info.app;
}

function newestIn(entries: LibraryEntry[], place: string): LibraryEntry | undefined {
  return entries.filter(e => placeOf(e.info) === place)
    .sort((a, b) => compareU64(b.info.sequence, a.info.sequence) || b.addedAt - a.addedAt)[0];
}

/** Libraries from before one version per application: the newest of each stays. */
async function keepNewest(entries: LibraryEntry[]): Promise<LibraryEntry[]> {
  const kept = entries.filter(e => newestIn(entries, placeOf(e.info)) === e);
  if (kept.length === entries.length) return entries;
  try {
    await save(kept);
  } catch {
    return entries;
  }
  forget(entries.filter(e => !kept.includes(e)));
  return kept;
}

function forget(dropped: LibraryEntry[]): void {
  for (const entry of dropped) {
    try {
      const file = packageFile(entry.sha256);
      if (file.exists) file.delete();
    } catch {
      // The index no longer lists it.
    }
  }
}

async function save(entries: LibraryEntry[]): Promise<void> {
  try {
    if (!dir().exists) dir().create({ intermediates: true });
    await indexFile().write(JSON.stringify(entries.map(({ sha256, fileName, addedAt }) => ({ sha256, fileName, addedAt }))));
  } catch {
    throw new LibraryError('storage');
  }
}

export type AddOutcome = {
  entries: LibraryEntry[];
  /** `replaced`: an older version of the application left; `older`: the library keeps a newer one. */
  outcome: 'added' | 'already' | 'replaced' | 'older';
  /** The version replaced, or the newer one kept. */
  other?: LibraryEntry;
};

/** Copies a picked file (already in the app's cache) into the library. The library keeps one
 * version per application (per format for the manager's releases): a newer or equal sequence
 * replaces the one held, an older is refused. */
export async function addPackage(entries: LibraryEntry[], cacheUri: string, fileName: string): Promise<AddOutcome> {
  const checked = await inspectPackage(cacheUri);
  if (entries.some(e => e.sha256 === checked.sha256)) return { entries, outcome: 'already' };
  const place = placeOf(checked.info);
  const held = newestIn(entries, place);
  if (held && compareU64(checked.info.sequence, held.info.sequence) < 0) return { entries, outcome: 'older', other: held };
  try {
    if (!dir().exists) dir().create({ intermediates: true });
    const target = packageFile(checked.sha256);
    if (target.exists) target.delete();
    await new File(cacheUri).move(target);
  } catch {
    throw new LibraryError('storage');
  }
  const entry: LibraryEntry = { sha256: checked.sha256, fileName: fileName.replace(/[^\x20-\x7e]/g, '').slice(0, 80) || 'package.nbt',
    size: checked.size, addedAt: Date.now(), info: checked.info };
  const replaced = entries.filter(e => placeOf(e.info) === place);
  const at = entries.findIndex(e => placeOf(e.info) === place);
  const next = entries.filter(e => !replaced.includes(e));
  next.splice(at < 0 ? next.length : at, 0, entry);
  await save(next);
  forget(replaced);
  return { entries: next, outcome: held ? 'replaced' : 'added', other: held };
}

export async function removePackage(entries: LibraryEntry[], sha256: string): Promise<LibraryEntry[]> {
  const next = entries.filter(e => e.sha256 !== sha256);
  await save(next);
  forget(entries.filter(e => e.sha256 === sha256));
  return next;
}

/** How the app names an application id: the manager's own releases are "NBT Manager". */
export function appLabel(app: string): string {
  return app === 'manager' ? 'NBT Manager' : app;
}

/** The newest library package for an application, by sequence; the later added on a tie. */
export function newestFor(entries: LibraryEntry[], app: string): LibraryEntry | undefined {
  return entries.filter(e => e.info.app === app)
    .sort((a, b) => compareU64(b.info.sequence, a.info.sequence) || b.addedAt - a.addedAt)[0];
}

/** True when the library holds a higher sequence than the car runs. */
export function updateAvailable(entries: LibraryEntry[], app: CarApp): boolean {
  const newest = newestFor(entries, app.id);
  return !!newest && compareU64(newest.info.sequence, app.sequence) > 0;
}

/**
 * The manager release to send to a car: the newest it reads (its formats; up to NBTRLS2 for a
 * manager without `/v1/manager`, `car` null) and newer than it runs. `then` is a newer one it
 * reads only after `next` (a step release first); `unreadable`, the newest when it reads none.
 * Unknown car (undefined): the newest.
 */
export function managerChoice(entries: LibraryEntry[], car: CarManager | null | undefined):
  { next?: LibraryEntry; then?: LibraryEntry; unreadable?: LibraryEntry } {
  const releases = entries.filter(e => e.info.app === 'manager')
    .sort((a, b) => compareU64(b.info.sequence, a.info.sequence) || b.addedAt - a.addedAt);
  if (car === undefined) return { next: releases[0] };
  const formats = car ? car.formats : [1, 2];
  const newer = releases.filter(e => !car || compareU64(e.info.sequence, car.sequence) > 0);
  const next = newer.find(e => formats.includes(e.info.format ?? 1));
  const newest = newer[0];
  if (!next) return newest ? { unreadable: newest } : {};
  return newest !== next ? { next, then: newest } : { next };
}
