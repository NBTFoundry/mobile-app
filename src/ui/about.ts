// SPDX-License-Identifier: MPL-2.0
/** A package's description for a list or a page: a lead of two lines at most, the rest
 * behind "More details". */

/** About what two lines hold on a narrow phone; a longer lead is cut by the layout. */
export const LEAD_FITS = 70;

export type About = { lead?: string; rest: string[] };

/** `summary` (the catalog's line) comes first; an empty `text` line separates paragraphs. */
export function aboutText(text: readonly string[] | undefined, summary?: string): About {
  const paragraphs = [summary ?? '', ...(text ?? []).join('\n').split(/\n{2,}/)]
    .map(p => p.trim()).filter(Boolean);
  // The package often repeats the catalog's line.
  const distinct = paragraphs.filter((p, i) => paragraphs.indexOf(p) === i);
  return { lead: distinct[0], rest: distinct.slice(1) };
}

/** Whether the lead alone leaves something unsaid. */
export function hasMore(about: About, others: number): boolean {
  return others > 0 || about.rest.length > 0 || (about.lead?.length ?? 0) > LEAD_FITS;
}
