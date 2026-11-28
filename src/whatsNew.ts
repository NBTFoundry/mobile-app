// SPDX-License-Identifier: MPL-2.0
/** What changed, shown once after an update (WhatsNewSheet). With each store release that brings
 * something to tell: raise WHATS_NEW_ID and replace the items (i18n keys, seven languages). */
import type { Key } from './i18n';

export const WHATS_NEW_ID = 4;
export const WHATS_NEW_ITEMS: readonly Key[] = ['whatsNew.layout', 'whatsNew.settings', 'whatsNew.updates', 'whatsNew.diagnostics'];

/** An older list seen: show this one. None seen: only for someone who used the app before
 * this sheet existed (cars or packages); a new install starts from this list. */
export function shouldShowWhatsNew(seen: number | undefined, usedBefore: boolean): boolean {
  return seen === undefined ? usedBefore : seen < WHATS_NEW_ID;
}
