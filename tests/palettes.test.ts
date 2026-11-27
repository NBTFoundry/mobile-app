// SPDX-License-Identifier: MPL-2.0
import { CAR_THEMES } from '../src/protocol/replies';
import { paletteOf, type Palette } from '../src/ui/palettes';

/** WCAG relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const cases = CAR_THEMES.flatMap(theme => [true, false].map(dark =>
  [`${theme} ${dark ? 'dark' : 'light'}`, paletteOf(theme, dark), dark] as [string, Palette, boolean]));

describe('palettes', () => {
  it.each(cases)('%s reads well', (_name, p, dark) => {
    expect(p.isDark).toBe(dark);
    for (const color of [p.page, p.panel, p.line, p.text, p.muted, p.accent, p.fill, p.fillText, p.ok, p.warn, p.bad, p.glow]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const surface of [p.page, p.panel]) {
      expect(contrast(p.text, surface)).toBeGreaterThan(12);
      // Body-size text: WCAG AA.
      for (const ink of [p.muted, p.accent, p.ok, p.warn, p.bad]) expect(contrast(ink, surface)).toBeGreaterThan(4.5);
    }
    expect(contrast(p.fillText, p.fill)).toBeGreaterThan(4.5);
    expect(p.corner).toBeGreaterThanOrEqual(0);
    expect(p.card).toBeGreaterThanOrEqual(0);
  });

  it('has a theme per make, each with its own accent', () => {
    for (const dark of [true, false]) {
      expect(new Set(CAR_THEMES.map(theme => paletteOf(theme, dark).accent)).size).toBe(CAR_THEMES.length);
    }
  });
});
