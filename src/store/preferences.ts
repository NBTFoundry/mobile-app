// SPDX-License-Identifier: MPL-2.0
/** The app's own preferences, in its storage: the language chosen (i18n), light or dark, the
 * theme, whether betas (pre-releases) are offered, what the app does when it opens, the answer
 * about diagnostics
 * (diagnostics.ts) and the last "What's new" list seen (whatsNew.ts). No React Native here:
 * tests use it. */
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { currentChoice, isChoice, setChoice, type Choice } from '../i18n';
import { CAR_THEMES, type CarTheme } from '../protocol/replies';

const file = () => new File(Paths.document, 'preferences.json');

/** `auto`: as the phone. */
export const APPEARANCES = ['auto', 'light', 'dark'] as const;
export type Appearance = (typeof APPEARANCES)[number];
/** `car`: the selected car's own theme. */
export const THEME_CHOICES = ['car', ...CAR_THEMES] as const;
export type ThemeChoice = CarTheme | 'car';

type Values = {
  betas: boolean;
  appearance: Appearance;
  theme: ThemeChoice;
  /** When the app opens: read the selected car's applications. */
  autoConnect: boolean;
  /** Unset: never changed, which is on. */
  diagnostics?: boolean;
  whatsNew?: number;
};

const DEFAULTS: Values = { betas: false, appearance: 'auto', theme: 'car', autoConnect: false };
let values: Values = DEFAULTS;
const listeners = new Set<() => void>();

function set(change: Partial<Values>): void {
  values = { ...values, ...change };
  listeners.forEach(listener => listener());
}

const one = <T>(allowed: readonly T[], value: unknown): T | undefined =>
  (allowed.includes(value as T) ? value as T : undefined);

/** Applies the saved preferences; the defaults when there are none or they cannot be read. */
export async function loadPreferences(): Promise<void> {
  try {
    const stored = file();
    if (!stored.exists) return;
    const raw = JSON.parse(await stored.text()) as Record<string, unknown> | null;
    if (isChoice(raw?.language)) setChoice(raw.language);
    set({
      betas: typeof raw?.betas === 'boolean' ? raw.betas : values.betas,
      appearance: one(APPEARANCES, raw?.appearance) ?? values.appearance,
      theme: one(THEME_CHOICES, raw?.theme) ?? values.theme,
      autoConnect: raw?.autoConnect === true,
      diagnostics: typeof raw?.diagnostics === 'boolean' ? raw.diagnostics : values.diagnostics,
      whatsNew: typeof raw?.whatsNew === 'number' && Number.isSafeInteger(raw.whatsNew) ? raw.whatsNew : values.whatsNew,
    });
  } catch {
    // Unreadable: the defaults.
  }
}

/** A default is not written: the file says what was chosen. */
async function save(): Promise<boolean> {
  const { betas, appearance, theme, autoConnect, diagnostics, whatsNew } = values;
  try {
    await file().write(JSON.stringify({ language: currentChoice(), betas, whatsNew, diagnostics,
      appearance: appearance === DEFAULTS.appearance ? undefined : appearance,
      theme: theme === DEFAULTS.theme ? undefined : theme,
      autoConnect: autoConnect || undefined }));
    return true;
  } catch {
    return false;
  }
}

function keep(change: Partial<Values>): Promise<boolean> {
  set(change);
  return save();
}

/** Shows `choice` at once and keeps it; false when it could not be kept. */
export async function chooseLanguage(choice: Choice): Promise<boolean> {
  setChoice(choice);
  return save();
}

export const chooseBetas = (betas: boolean) => keep({ betas });
export const chooseAppearance = (appearance: Appearance) => keep({ appearance });
export const chooseTheme = (theme: ThemeChoice) => keep({ theme });
export const chooseAutoConnect = (autoConnect: boolean) => keep({ autoConnect });
export const keepDiagnostics = (diagnostics: boolean) => keep({ diagnostics });
export const markWhatsNewSeen = (whatsNew: number) => keep({ whatsNew });
/** Shows the list again (About): as if an older one had been seen. */
export const showWhatsNewAgain = () => keep({ whatsNew: 0 });

export const showBetas = (): boolean => values.betas;
export const whatsNewSeen = (): number | undefined => values.whatsNew;
export const preferences = (): Readonly<Values> => values;

/** Re-renders when a preference changes. */
export function usePreferences(): Readonly<Values> {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, preferences);
}

export const useBetas = (): boolean => usePreferences().betas;
