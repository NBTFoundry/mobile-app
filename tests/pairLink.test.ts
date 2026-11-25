// SPDX-License-Identifier: MPL-2.0
import { parsePairLink, PAIR_LINK_MAX } from '../src/protocol/pairLink';
import { shouldShowWhatsNew, WHATS_NEW_ID } from '../src/whatsNew';

describe('pairing link', () => {
  const code = 'WIFI:T:WPA;S:NBT_1234;P:secret\\;pass;;';
  it('takes the Wi-Fi code another app hands over', () => {
    expect(parsePairLink(`nbtmanager://pair?wifi=${encodeURIComponent(code)}`))
      .toEqual({ ssid: 'NBT_1234', passphrase: 'secret;pass' });
  });
  it.each([
    null, undefined, '', 'nbtmanager://pair', `nbtmanager://pair?wifi=${encodeURIComponent('WIFI:S:x;;')}`,
    `https://pair?wifi=${encodeURIComponent(code)}`, `nbtmanager://pair?wifi=${encodeURIComponent(code)}&x=1`,
    'nbtmanager://pair?wifi=%E0%A4%A', `nbtmanager://pair?wifi=${'A'.repeat(PAIR_LINK_MAX)}`,
  ])('refuses anything else %#', url => expect(parsePairLink(url)).toBeNull());
});

describe("what's new", () => {
  it('shows a newer list once, and nothing to a new install', () => {
    expect(shouldShowWhatsNew(undefined, true)).toBe(true);
    expect(shouldShowWhatsNew(undefined, false)).toBe(false);
    expect(shouldShowWhatsNew(WHATS_NEW_ID - 1, false)).toBe(true);
    expect(shouldShowWhatsNew(WHATS_NEW_ID, true)).toBe(false);
  });
});
