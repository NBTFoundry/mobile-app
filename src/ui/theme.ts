// SPDX-License-Identifier: MPL-2.0
/**
 * Semantic colors and shapes shared by every screen: nbtfoundry.github.io's, in the system's
 * light or dark appearance, with one theme per make of car. The theme is the selected car's
 * (what its own screen shows, `GET /v1/theme`); BMW's for no car, or one that does not say.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import type { CarTheme } from '../protocol/replies';
import { paletteOf, type Palette } from './palettes';

export type { Palette } from './palettes';

let current: CarTheme = 'bmw';
const listeners = new Set<() => void>();

/** Shows `theme` on every screen at once; BMW's for none. */
export function setCarTheme(theme: CarTheme | undefined): void {
  const next = theme ?? 'bmw';
  if (next === current) return;
  current = next;
  listeners.forEach(listener => listener());
}

export const carTheme = (): CarTheme => current;

export function useColors(): Palette {
  const theme = useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, carTheme);
  return paletteOf(theme, useColorScheme() === 'dark');
}

export function useStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
