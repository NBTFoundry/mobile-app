// SPDX-License-Identifier: MPL-2.0
/** Another app hands over the car's Wi-Fi code (README, "Pairing from another app"):
 * `nbtmanager://pair?wifi=<the WIFI: text, URL-encoded>`. Untrusted: the code is checked like
 * a scanned one, and pairing still waits for the user here and the driver on the car. */
import { parseWifiCode, type WifiCode } from './wifiCode';

export const PAIR_LINK_MAX = 600;

export function parsePairLink(url: string | null | undefined): WifiCode | null {
  if (!url || url.length > PAIR_LINK_MAX) return null;
  const m = /^nbtmanager:\/\/pair\?wifi=([^&#]+)$/.exec(url);
  if (!m) return null;
  try {
    return parseWifiCode(decodeURIComponent(m[1]!));
  } catch {
    return null;
  }
}
