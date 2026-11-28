// SPDX-License-Identifier: MPL-2.0
/**
 * Semantic colors and shapes shared by every screen: nbtfoundry.github.io's, light or dark, with
 * one theme per make of car. Both follow More › Settings: Appearance (as the phone, light or
 * dark) and Theme (the selected car's, which is what its own screen shows, `GET /v1/theme`, or
 * one chosen). BMW's for no car, or one that does not say.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import type { CarTheme } from '../protocol/replies';
import { usePreferences } from '../store/preferences';
import { paletteOf, type Palette } from './palettes';

export type { Palette } from './palettes';

let current: CarTheme = 'bmw';
const listeners = new Set<() => void>();

/** The selected car's theme; BMW's for none. */
export function setCarTheme(theme: CarTheme | undefined): void {
  const next = theme ?? 'bmw';
  if (next === current) return;
  current = next;
  listeners.forEach(listener => listener());
}

export const carTheme = (): CarTheme => current;

export function useColors(): Palette {
  const car = useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, carTheme);
  const { appearance, theme } = usePreferences();
  const system = useColorScheme() === 'dark';
  return paletteOf(theme === 'car' ? car : theme, appearance === 'auto' ? system : appearance === 'dark');
}

export function useStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
