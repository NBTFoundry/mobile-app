/** Package files copied into the app's storage, indexed by their manifest. Shared by all cars. */
import { Directory, File, Paths } from 'expo-file-system';
import { CarLink } from '../../modules/car-link';
import { compareU64, fromHex } from '../protocol/bytes';
import { HEAD_READ, parsePackageHead, type PackageInfo } from '../protocol/packageHeader';
import type { CarApp } from '../protocol/replies';

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
    return entries;
  } catch {
    return [];
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

/** Copies a picked file (already in the app's cache) into the library. */
export async function addPackage(entries: LibraryEntry[], cacheUri: string, fileName: string): Promise<LibraryEntry[]> {
  const checked = await inspectPackage(cacheUri);
  if (entries.some(e => e.sha256 === checked.sha256)) return entries;
  try {
    if (!dir().exists) dir().create({ intermediates: true });
    const target = packageFile(checked.sha256);
    if (target.exists) target.delete();
    await new File(cacheUri).move(target);
  } catch {
    throw new LibraryError('storage');
  }
  const next = [...entries, { sha256: checked.sha256, fileName: fileName.replace(/[^\x20-\x7e]/g, '').slice(0, 80) || 'package.nbt',
    size: checked.size, addedAt: Date.now(), info: checked.info }];
  await save(next);
  return next;
}

export async function removePackage(entries: LibraryEntry[], sha256: string): Promise<LibraryEntry[]> {
  const next = entries.filter(e => e.sha256 !== sha256);
  await save(next);
  try {
    const file = packageFile(sha256);
    if (file.exists) file.delete();
  } catch {
    // The index no longer lists it.
  }
  return next;
}

/** The newest library package for an application, by sequence. */
/** How the app names an application id: the manager's own releases are "NBT Manager". */
export function appLabel(app: string): string {
  return app === 'manager' ? 'NBT Manager' : app;
}

export function newestFor(entries: LibraryEntry[], app: string): LibraryEntry | undefined {
  return entries.filter(e => e.info.app === app)
    .sort((a, b) => compareU64(b.info.sequence, a.info.sequence))[0];
}

/** True when the library holds a higher sequence than the car runs. */
export function updateAvailable(entries: LibraryEntry[], app: CarApp): boolean {
  const newest = newestFor(entries, app.id);
  return !!newest && compareU64(newest.info.sequence, app.sequence) > 0;
}
