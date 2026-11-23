// SPDX-License-Identifier: MPL-2.0
/** The app's own preferences, in its storage: the language chosen (i18n) and whether Get apps
 * offers betas (pre-releases). */
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { currentChoice, isChoice, setChoice, type Choice } from '../i18n';

const file = () => new File(Paths.document, 'preferences.json');

let betas = false;
const listeners = new Set<() => void>();

/** Applies the saved preferences; the defaults (Automatic, no betas) when there are none or they cannot be read. */
export async function loadPreferences(): Promise<void> {
  try {
    const stored = file();
    if (!stored.exists) return;
    const raw = JSON.parse(await stored.text()) as { language?: unknown; betas?: unknown } | null;
    if (isChoice(raw?.language)) setChoice(raw.language);
    if (typeof raw?.betas === 'boolean' && raw.betas !== betas) {
      betas = raw.betas;
      listeners.forEach(listener => listener());
    }
  } catch {
    // Unreadable: the defaults.
  }
}

async function save(): Promise<boolean> {
  try {
    await file().write(JSON.stringify({ language: currentChoice(), betas }));
    return true;
  } catch {
    return false;
  }
}

/** Shows `choice` at once and keeps it; false when it could not be kept. */
export async function chooseLanguage(choice: Choice): Promise<boolean> {
  setChoice(choice);
  return save();
}

export async function chooseBetas(on: boolean): Promise<boolean> {
  betas = on;
  listeners.forEach(listener => listener());
  return save();
}

export const showBetas = (): boolean => betas;

export function useBetas(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, showBetas);
}
