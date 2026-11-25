// SPDX-License-Identifier: MPL-2.0
/** The app's own preferences, in its storage: the language chosen (i18n), whether Get apps
 * offers betas (pre-releases) and the last "What's new" list seen (whatsNew.ts). */
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { currentChoice, isChoice, setChoice, type Choice } from '../i18n';

const file = () => new File(Paths.document, 'preferences.json');

let betas = false;
let whatsNew: number | undefined;
const listeners = new Set<() => void>();

/** Applies the saved preferences; the defaults (Automatic, no betas) when there are none or they cannot be read. */
export async function loadPreferences(): Promise<void> {
  try {
    const stored = file();
    if (!stored.exists) return;
    const raw = JSON.parse(await stored.text()) as { language?: unknown; betas?: unknown; whatsNew?: unknown } | null;
    if (isChoice(raw?.language)) setChoice(raw.language);
    if (typeof raw?.whatsNew === 'number' && Number.isSafeInteger(raw.whatsNew)) whatsNew = raw.whatsNew;
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
    await file().write(JSON.stringify({ language: currentChoice(), betas, whatsNew }));
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

export const whatsNewSeen = (): number | undefined => whatsNew;

export function markWhatsNewSeen(id: number): Promise<boolean> {
  whatsNew = id;
  return save();
}

export function useBetas(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, showBetas);
}
