// SPDX-License-Identifier: MPL-2.0
/**
 * The app's languages. Automatic follows the phone's language and shows English
 * for one the app does not have (Dutch, Korean, ...); the Language row chooses one
 * (ui/LanguageRow.tsx, store/preferences.ts). No React Native here: tests use it.
 */
import { useSyncExternalStore } from 'react';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { ja } from './ja';
import { zh } from './zh';

export type Key = keyof typeof en;
/** Every language has exactly English's keys. */
export type Messages = Record<Key, string>;
/** Keys with a `.one` and an `.other` form. */
export type CountKey = { [K in Key]: K extends `${infer Base}.one` ? Base : never }[Key];
export type Params = Record<string, string | number>;

export const LANGUAGES = ['en', 'fr', 'de', 'it', 'es', 'zh', 'ja'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Choice = Language | 'auto';

/** Each language by its own name, the same in every language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', es: 'Español', zh: '中文', ja: '日本語',
};

const CATALOGS: Record<Language, Messages> = { en, fr, de, it, es, zh, ja };
/** For dates and times. */
const LOCALES: Record<Language, string> = {
  en: 'en', fr: 'fr', de: 'de', it: 'it', es: 'es', zh: 'zh-CN', ja: 'ja',
};

/** The app's language for a system locale ("fr_FR", "zh-Hant-TW", "nl-NL"). */
export function languageFor(locale: string | null | undefined): Language {
  const code = (locale ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return (LANGUAGES as readonly string[]).includes(code) ? code as Language : 'en';
}

export function isChoice(value: unknown): value is Choice {
  return value === 'auto' || (LANGUAGES as readonly unknown[]).includes(value);
}

let system: Language = 'en';
let choice: Choice = 'auto';
let shown: Language = 'en';
const listeners = new Set<() => void>();

function apply(): void {
  const next = choice === 'auto' ? system : choice;
  if (next === shown) return;
  shown = next;
  listeners.forEach(listener => listener());
}

/** The phone's language, as the app has it. */
export function setSystemLocale(locale: string | null | undefined): void {
  system = languageFor(locale);
  apply();
}

export function setChoice(next: Choice): void {
  choice = next;
  apply();
}

export const currentChoice = (): Choice => choice;
export const currentLanguage = (): Language => shown;
export const systemLanguage = (): Language => system;

/** Re-renders when the language shown changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, currentLanguage);
}

function fill(text: string, params?: Params): string {
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    (name in params ? String(params[name]) : whole)) : text;
}

/** `key` in the language shown, with its `{name}`s filled. */
export function t(key: Key, params?: Params): string {
  return fill(CATALOGS[shown][key] ?? en[key], params);
}

/** A count's form: French uses the singular for 0 and 1; Chinese and Japanese have one form. */
export function tn(key: CountKey, count: number, params?: Params): string {
  const one = shown === 'fr' ? count <= 1 : count === 1;
  return t(`${key}.${one ? 'one' : 'other'}` as Key, { count, ...params });
}

export const formatDateTime = (ms: number) => new Date(ms).toLocaleString(LOCALES[shown]);
export const formatDate = (ms: number) => new Date(ms).toLocaleDateString(LOCALES[shown]);
export const formatTime = (ms: number) => new Date(ms).toLocaleTimeString(LOCALES[shown]);
/** Short, for a status line: the time when it was today, else the date. */
export function formatWhen(ms: number, now = Date.now()): string {
  const date = new Date(ms);
  return date.toDateString() === new Date(now).toDateString()
    ? date.toLocaleTimeString(LOCALES[shown], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString(LOCALES[shown]);
}

/** For tests: every catalog. */
export const catalogs = (): Readonly<Record<Language, Messages>> => CATALOGS;
