// SPDX-License-Identifier: MPL-2.0
/** Downloads a catalog release into the library: each file checked against the catalog (size,
 * SHA-256, application and sequence) before the library takes it. The car verifies the signature. */
import { File, Paths } from 'expo-file-system';
import { CatalogError, type CatalogApp, type CatalogRelease } from './catalog';
import { addPackage, inspectPackage, type AddOutcome, type LibraryEntry } from './library';

/** Bytes written of all the release's files, and their total. */
export type DownloadProgress = { done: number; total: number };

async function fetchFile(url: string, target: File, size: number, onBytes: (n: number) => void): Promise<void> {
  const abort = new AbortController();
  let tooLarge = false;
  try {
    await File.downloadFileAsync(url, target, {
      idempotent: true,
      signal: abort.signal,
      onProgress: ({ bytesWritten }) => {
        if (bytesWritten > size) {
          tooLarge = true;
          abort.abort();
        }
        onBytes(Math.min(bytesWritten, size));
      },
    });
  } catch {
    throw new CatalogError(tooLarge ? 'mismatch' : 'download');
  }
}

export async function downloadRelease(entries: LibraryEntry[], app: CatalogApp, release: CatalogRelease,
  onProgress: (progress: DownloadProgress) => void = () => {}): Promise<{ entries: LibraryEntry[]; outcomes: AddOutcome[] }> {
  const total = release.files.reduce((sum, f) => sum + f.size, 0);
  let before = 0;
  let current = entries;
  const outcomes: AddOutcome[] = [];
  for (const file of release.files) {
    const target = new File(Paths.cache, `download-${file.sha256}.part`);
    try {
      await fetchFile(file.url, target, file.size, n => onProgress({ done: before + n, total }));
      const checked = await inspectPackage(target.uri);
      if (checked.size !== file.size || checked.sha256 !== file.sha256 || checked.info.app !== app.id
        || checked.info.sequence !== file.sequence || checked.info.version !== file.version) {
        throw new CatalogError('mismatch');
      }
      const added = await addPackage(current, target.uri, file.name, checked);
      current = added.entries;
      outcomes.push(added);
    } finally {
      try {
        if (target.exists) target.delete();
      } catch {
        // The cache folder is the system's to clear.
      }
    }
    before += file.size;
  }
  return { entries: current, outcomes };
}
