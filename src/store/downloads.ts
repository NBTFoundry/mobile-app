// SPDX-License-Identifier: MPL-2.0
/** Downloads from the catalog into the library, one at a time, for every screen that shows
 * them: the list and the application's page see the same progress. */
import { useSyncExternalStore } from 'react';
import { describeError } from '../car/messages';
import type { CatalogApp, CatalogRelease } from './catalog';
import { downloadRelease } from './download';
import type { LibraryEntry } from './library';

/** Under way (0 to 1), or why the last one failed. */
export type DownloadState = { fraction: number } | { problem: string };

let states: Readonly<Record<string, DownloadState>> = {};
let queue: Promise<void> = Promise.resolve();
let library: { get: () => LibraryEntry[]; set: (entries: LibraryEntry[]) => void } | undefined;
const listeners = new Set<() => void>();

function put(app: string, state: DownloadState | undefined): void {
  const { [app]: _old, ...rest } = states;
  states = state ? { ...rest, [app]: state } : rest;
  listeners.forEach(listener => listener());
}

/** Where downloads read the library as it is now, and put it once they have added to it. */
export function bindLibrary(get: () => LibraryEntry[], set: (entries: LibraryEntry[]) => void): void {
  library = { get, set };
}

export const isDownloading = (state: DownloadState | undefined): state is { fraction: number } =>
  !!state && 'fraction' in state;

/** Starts the download unless it already runs; it waits for the one before it. */
export function startDownload(app: CatalogApp, release: CatalogRelease): void {
  if (isDownloading(states[app.id])) return;
  put(app.id, { fraction: 0 });
  queue = queue.then(async () => {
    try {
      if (!library) throw new Error('no library');
      const result = await downloadRelease(library.get(), app, release,
        progress => put(app.id, { fraction: progress.done / Math.max(progress.total, 1) }));
      library.set(result.entries);
      put(app.id, undefined);
    } catch (error) {
      put(app.id, { problem: describeError(error) });
    }
  });
}

export function useDownloads(): Readonly<Record<string, DownloadState>> {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => states);
}
