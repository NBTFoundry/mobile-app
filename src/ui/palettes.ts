// SPDX-License-Identifier: MPL-2.0
/**
 * The colors and shapes of each theme: nbtfoundry.github.io's, light and dark, one theme per
 * make of car. No React Native here: tests use it.
 */
import type { CarTheme } from '../protocol/replies';

export type Palette = {
  isDark: boolean;
  page: string; panel: string; line: string; text: string; muted: string;
  /** `accent`: links, plain buttons and marks; `fill` and `fillText`: the main button. */
  accent: string; fill: string; fillText: string; ok: string; warn: string; bad: string;
  /** The slanted bar before a label and the selected tab's line. */
  glow: string;
  /** Corner radius of buttons, fields and tags; of panels and dialogs. */
  corner: number; card: number;
};

const status = {
  dark: { ok: '#4cc38a', warn: '#efc875', bad: '#ffb4ab' },
  light: { ok: '#18794e', warn: '#7a5200', bad: '#b3261e' },
};

/** BMW: the website's blue on near-black, its orange bar, square corners. MINI and Supra take
 * the colour of their own screen's cursor, from photographs of each (NBT Manager's
 * docs/head-unit-interfaces.md): MINI blue, round; Supra orange-red, sharp. */
const themes: Record<CarTheme, { dark: Palette; light: Palette }> = {
  bmw: {
    dark: { isDark: true, ...status.dark, page: '#0a0c0f', panel: '#13161b', line: '#252a32', text: '#eef1f4',
      muted: '#9aa3ae', accent: '#5b9cf0', fill: '#1c69d4', fillText: '#ffffff', glow: '#ff6a1a', corner: 4, card: 6 },
    light: { isDark: false, ...status.light, page: '#f3f4f6', panel: '#ffffff', line: '#d8dbe0', text: '#14171b',
      muted: '#59616c', accent: '#1c69d4', fill: '#1c69d4', fillText: '#ffffff', glow: '#ff6a1a', corner: 4, card: 6 },
  },
  mini: {
    dark: { isDark: true, ...status.dark, page: '#05080c', panel: '#0e151d', line: '#1f2c3a', text: '#eef3f8',
      muted: '#9aa8b6', accent: '#4db5ff', fill: '#0a6fb4', fillText: '#ffffff', glow: '#38d8f0', corner: 24, card: 20 },
    light: { isDark: false, ...status.light, page: '#f2f5f8', panel: '#ffffff', line: '#d5dce4', text: '#0f1620',
      muted: '#55616e', accent: '#0a66a8', fill: '#0a66a8', fillText: '#ffffff', glow: '#0888d8', corner: 24, card: 20 },
  },
  supra: {
    dark: { isDark: true, ...status.dark, page: '#0b0b0c', panel: '#161618', line: '#2c2c30', text: '#f3f3f4',
      muted: '#a5a5aa', accent: '#ff7a4d', fill: '#c2410c', fillText: '#ffffff', glow: '#f85828', corner: 2, card: 3 },
    light: { isDark: false, ...status.light, page: '#f4f4f5', panel: '#ffffff', line: '#dbdbde', text: '#131314',
      muted: '#5d5d63', accent: '#b83a0a', fill: '#b83a0a', fillText: '#ffffff', glow: '#f85828', corner: 2, card: 3 },
  },
};

export const paletteOf = (theme: CarTheme, dark: boolean): Palette => themes[theme][dark ? 'dark' : 'light'];
