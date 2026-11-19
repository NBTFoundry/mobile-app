// SPDX-License-Identifier: MPL-2.0
/** How long the car's network is kept when nothing uses it.
 *
 * Android drops the car's network as soon as no request holds it, so the app holds it between
 * actions (decided 2026-11-14) and lets go after IDLE_RELEASE_MS without one. Switching to
 * another app (to save a log, say) keeps it BACKGROUND_RELEASE_MS (the user, 2026-11-17: the
 * immediate release on going to the background cut the link while saving logs). */
export const IDLE_RELEASE_MS = 5 * 60_000;
export const BACKGROUND_RELEASE_MS = 2 * 60_000;

/** Milliseconds until the network is let go, from when the app went to the background
 * (0 when it is in the foreground). */
export function releaseDelay(backgroundSince: number, now: number): number {
  if (!backgroundSince) return IDLE_RELEASE_MS;
  return Math.max(0, backgroundSince + BACKGROUND_RELEASE_MS - now);
}
