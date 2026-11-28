// SPDX-License-Identifier: MPL-2.0
/** Updates of this app between store builds (expo-updates, docs/updates.md): its screens and
 * texts, never its native side. Looked for by the app itself, with no switch: when it opens and
 * when it comes back to the front (`followAppUpdates`), and when the user asks (About, or the
 * catalog in Apps). A downloaded update starts with the app the next time, or at once from
 * the bar over the tabs (UpdateBar) or About. */
import * as Updates from 'expo-updates';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/** `none`: checked, nothing newer; `ready`: downloaded, starts with the app. */
export type AppUpdate = { phase: 'idle' | 'checking' | 'none' | 'ready' | 'failed' };

/** Coming back to the front looks again only after this long. */
export const RECHECK_MS = 3_600_000;

let state: AppUpdate = { phase: 'idle' };
let lookedAt: number | undefined;
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
  lookedAt = Date.now();
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

/** Looks now, and each time the app comes back to the front an hour or more after the last
 * look; failures stay quiet. Returns what stops it. */
export function followAppUpdates(): () => void {
  const look = () => {
    if (lookedAt === undefined || Date.now() - lookedAt >= RECHECK_MS) void checkAppUpdate(true);
  };
  look();
  const listening = AppState.addEventListener('change', now => { if (now === 'active') look(); });
  return () => listening.remove();
}

/** Starts the downloaded update now; the user asked. */
export async function restartForUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    set('failed');
  }
}

export const appUpdate = (): AppUpdate => state;

export function useAppUpdate(): AppUpdate {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => state);
}
