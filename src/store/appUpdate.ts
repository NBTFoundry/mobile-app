// SPDX-License-Identifier: MPL-2.0
/** Updates of this app between store builds (expo-updates, docs/updates.md): its screens and
 * texts, never its native side. Nothing is checked on its own: the user asks (About), or reads
 * the catalog (Apps), which goes online anyway. A downloaded update starts with the app the
 * next time, or at once from About. */
import * as Updates from 'expo-updates';
import { useSyncExternalStore } from 'react';

/** `none`: checked, nothing newer; `ready`: downloaded, starts with the app. */
export type AppUpdate = { phase: 'idle' | 'checking' | 'none' | 'ready' | 'failed' };

let state: AppUpdate = { phase: 'idle' };
const listeners = new Set<() => void>();

function set(phase: AppUpdate['phase']): void {
  state = { phase };
  listeners.forEach(listener => listener());
}

/** False in a development build and in a kit build, which run the code they were built from. */
export const updatesEnabled = (): boolean => Updates.isEnabled && !__DEV__;

/** The update this app runs: the one it was built with (`embedded`) or a later one. */
export function runningUpdate(): { embedded: boolean; createdAt?: number; id?: string } {
  return { embedded: !updatesEnabled() || Updates.isEmbeddedLaunch, createdAt: Updates.createdAt?.getTime(),
    id: Updates.updateId ?? undefined };
}

/** Looks for a newer update and downloads it. Never throws: a failure shows in About, unless
 * the check came with something else (`quiet`: the catalog, the app opening). */
export async function checkAppUpdate(quiet = false): Promise<void> {
  if (!updatesEnabled() || state.phase === 'checking' || state.phase === 'ready') return;
  set('checking');
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return set('none');
    const fetched = await Updates.fetchUpdateAsync();
    set(fetched.isNew || fetched.isRollBackToEmbedded ? 'ready' : 'none');
  } catch {
    set(quiet ? 'idle' : 'failed');
  }
}

/** Starts the downloaded update now; the user asked. */
export async function restartForUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    set('failed');
  }
}

export function useAppUpdate(): AppUpdate {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => state);
}
