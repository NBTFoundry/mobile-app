// SPDX-License-Identifier: MPL-2.0
/** Where Back leads, and when a screen counts as another one. */
import { back, depth, screenKey, type Route } from '../src/route';

it('goes back one level at a time, then to the first tab, then out of the app', () => {
  const section: Route = { tab: 'apps', app: 'doom', carId: 'c1', section: 'settings' };
  expect(depth(section)).toBe(2);
  expect(back(section)).toEqual({ tab: 'apps', app: 'doom', carId: 'c1' });
  expect(back({ tab: 'apps', app: 'doom', carId: 'c1' })).toEqual({ tab: 'apps' });
  expect(back({ tab: 'car', tool: 'selfTest' })).toEqual({ tab: 'car' });
  expect(back({ tab: 'more', page: 'downloads' })).toEqual({ tab: 'more' });
  expect(back({ tab: 'more' })).toEqual({ tab: 'apps' });
  expect(back({ tab: 'car' })).toEqual({ tab: 'apps' });
  expect(back({ tab: 'apps' })).toBeUndefined();
});

it('counts a page, an application and a tool as one level below a tab', () => {
  expect(depth({ tab: 'car' })).toBe(0);
  expect(depth({ tab: 'car', page: 'pairing' })).toBe(1);
  expect(depth({ tab: 'car', app: 'manager', carId: 'c1' })).toBe(1);
  expect(depth({ tab: 'car', tool: 'logs' })).toBe(1);
  // A section without its application is not a place.
  expect(depth({ tab: 'apps', section: 'about' })).toBe(0);
});

it('names each screen apart', () => {
  const keys = ([
    { tab: 'apps' }, { tab: 'car' }, { tab: 'more' }, { tab: 'more', page: 'activity' }, { tab: 'apps', page: 'activity' },
    { tab: 'apps', app: 'doom', carId: 'c1' }, { tab: 'apps', app: 'doom', carId: 'c2' }, { tab: 'apps', app: 'doom' },
    { tab: 'apps', app: 'doom', carId: 'c1', section: 'about' }, { tab: 'car', tool: 'logs' }, { tab: 'car', tool: 'crashes' },
    { tab: 'car', page: 'pairing' }, { tab: 'car', page: 'pairing', pairCode: { ssid: 'DIRECT-car', passphrase: 'p' } },
  ] as Route[]).map(screenKey);
  expect(new Set(keys).size).toBe(keys.length);
});
