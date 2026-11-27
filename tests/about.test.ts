// SPDX-License-Identifier: MPL-2.0
import { aboutText, hasMore, LEAD_FITS } from '../src/ui/about';

describe('a package description', () => {
  test('leads with the catalog line, then the package paragraphs', () => {
    const about = aboutText(['First line', 'goes on.', '', 'Second paragraph.'], 'A game.');
    expect(about).toEqual({ lead: 'A game.', rest: ['First line\ngoes on.', 'Second paragraph.'] });
  });

  test('leads with the first paragraph without a catalog line', () => {
    expect(aboutText(['Only this.'])).toEqual({ lead: 'Only this.', rest: [] });
    expect(aboutText(undefined)).toEqual({ lead: undefined, rest: [] });
  });

  test('says a repeated line once', () => {
    expect(aboutText(['A game.', '', 'More.'], 'A game.')).toEqual({ lead: 'A game.', rest: ['More.'] });
  });

  test('offers more only when something is left unsaid', () => {
    expect(hasMore({ lead: 'Short.', rest: [] }, 0)).toBe(false);
    expect(hasMore({ lead: 'Short.', rest: [] }, 1)).toBe(true);
    expect(hasMore({ lead: 'Short.', rest: ['More.'] }, 0)).toBe(true);
    expect(hasMore({ lead: 'x'.repeat(LEAD_FITS + 1), rest: [] }, 0)).toBe(true);
    expect(hasMore({ rest: [] }, 0)).toBe(false);
  });
});
