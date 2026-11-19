// SPDX-License-Identifier: MPL-2.0
/** Semantic colors shared by every screen. */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
const dark = {
  isDark: true,
  page: '#111318', panel: '#1c1f26', line: '#363b45', text: '#f1f3f7', muted: '#aeb6c5',
  accent: '#a8c7ff', accentText: '#082b60', ok: '#82d6ad', warn: '#efc875', bad: '#ffb4ab',
};
const light: typeof dark = {
  isDark: false,
  page: '#f6f7fa', panel: '#ffffff', line: '#dce0e7', text: '#1a1d24', muted: '#5c6574',
  accent: '#245bb5', accentText: '#ffffff', ok: '#176b48', warn: '#805500', bad: '#b3261e',
};
export type Palette = typeof dark;
export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
export function useStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
