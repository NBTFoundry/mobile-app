// SPDX-License-Identifier: MPL-2.0
/** One list from the car, the downloads and the catalog: each application once, with its next step. */
import { appItem, appList } from '../src/store/appList';
import type { CarRecord } from '../src/store/cars';
import type { Catalog, CatalogApp } from '../src/store/catalog';
import type { LibraryEntry } from '../src/store/library';

jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));
jest.mock('../modules/car-link', () => ({ CarLink: {} }));

const car = (apps: [string, string, string][] | undefined, manager?: [string, string] | null): CarRecord => ({
  id: '0123456789abcdef', name: 'My car', ssid: 's', passphrase: 'p', bssid: 'b', address: '1.1.1.1:80',
  keyAlias: 'car-0123456789abcdef', keyId: 'ab'.repeat(32), protection: 'tee',
  apps: apps?.map(([id, version, sequence]) => ({ id, version, sequence, running: false })),
  manager: manager ? { version: manager[0], sequence: manager[1], formats: [3] } : manager,
});
const held = (app: string, version: string, sequence: string): LibraryEntry => ({
  sha256: `${app}${sequence}`.padEnd(64, '0'), fileName: `${app}.nbt`, size: 10, addedAt: 1,
  info: { app, version, sequence, compat: '', payloadSize: 0, payloadSha256: '', settings: [] },
});
const online = (id: string, name: string, ...releases: [string, string, boolean?][]): CatalogApp => ({
  id, name, summary: `${name} summary`, repo: `NBTFoundry/nf-${id}`, license: 'MIT', category: 'games',
  releases: releases.map(([version, sequence, prerelease]) => ({ version, sequence, prerelease: !!prerelease, compat: '',
    properties: [], text: [], notes: [], files: [] })),
});
const catalog = (...apps: CatalogApp[]): Catalog => ({ generated: 0, fetchedAt: 0, apps });

it('names the next step of an application on the car', () => {
  const doom = online('doom', 'Doom', ['1.0.24', '24']);
  const c = car([['doom', '1.0.23', '23']]);
  // Newer online only: get it first.
  expect(appItem('doom', c, [], catalog(doom), false)).toMatchObject({ name: 'Doom', onCar: true, step: 'get', target: '1.0.24' });
  // Downloaded: send it to the car.
  expect(appItem('doom', c, [held('doom', '1.0.24', '24')], catalog(doom), false)).toMatchObject({ step: 'update', target: '1.0.24' });
  // An older download does not hide the newer release.
  expect(appItem('doom', car([['doom', '1.0.22', '22']]), [held('doom', '1.0.23', '23')], catalog(doom), false))
    .toMatchObject({ step: 'get', target: '1.0.24' });
  // The car runs the newest: nothing to do, with or without a catalog.
  expect(appItem('doom', car([['doom', '1.0.24', '24']]), [held('doom', '1.0.24', '24')], catalog(doom), false))
    .toMatchObject({ step: 'none', target: undefined });
  expect(appItem('doom', c, [], undefined, false)).toMatchObject({ name: 'doom', step: 'none' });
});

it('offers betas only when chosen', () => {
  const pcsx = online('pcsx', 'PCSX', ['0.1.1', '5'], ['0.2.0-beta', '6', true]);
  expect(appItem('pcsx', car([]), [], catalog(pcsx), false)).toMatchObject({ step: 'get', target: '0.1.1' });
  expect(appItem('pcsx', car([]), [], catalog(pcsx), true)).toMatchObject({ step: 'get', target: '0.2.0-beta' });
});

it('installs what is downloaded and not on the car; without a car there is only the download', () => {
  const lib = [held('gauges', '0.2.0', '9')];
  expect(appItem('gauges', car([]), lib, undefined, false)).toMatchObject({ onCar: false, step: 'install', target: '0.2.0' });
  expect(appItem('gauges', undefined, lib, undefined, false)).toMatchObject({ onCar: false, step: 'none' });
  expect(appItem('gauges', undefined, [], catalog(online('gauges', 'Gauges', ['0.2.0', '9'])), false)).toMatchObject({ step: 'get' });
});

it('treats NBT Manager as on the car, also on a car that does not say which it runs', () => {
  const manager = online('manager', 'NBT Manager', ['0.5.5', '55']);
  expect(appItem('manager', car([], ['0.5.4', '54']), [], catalog(manager), false)).toMatchObject({ onCar: true, step: 'get' });
  expect(appItem('manager', car([], ['0.5.4', '54']), [held('manager', '0.5.5', '55')], catalog(manager), false))
    .toMatchObject({ step: 'update', target: '0.5.5' });
  expect(appItem('manager', car([], ['0.5.5', '55']), [held('manager', '0.5.5', '55')], catalog(manager), false))
    .toMatchObject({ step: 'none' });
  expect(appItem('manager', car([], null), [held('manager', '0.5.5', '55')], catalog(manager), false))
    .toMatchObject({ onCar: true, installed: undefined, step: 'update' });
});

it('lists updates first, then the car’s applications, then the rest with downloads first', () => {
  const list = appList(car([['doom', '1.0.23', '23'], ['gauges', '0.2.0', '9'], ['test', 'v1', '1']], ['0.5.5', '55']),
    [held('doom', '1.0.24', '24'), held('fbneo', '0.1.1', '3')],
    catalog(online('manager', 'NBT Manager', ['0.5.5', '55']), online('doom', 'Doom', ['1.0.24', '24']),
      online('pcsx', 'PCSX', ['0.1.1', '5']), online('fbneo', 'FinalBurn Neo', ['0.1.1', '3']),
      online('snes9x', 'Snes9x', ['2.0-beta', '7', true])), false);
  expect(list.updates.map(i => i.id)).toEqual(['doom']);
  expect(list.onCar.map(i => i.id)).toEqual(['gauges', 'test']);
  // A beta alone is not offered; NBT Manager is up to date, so it stays on the Car tab.
  expect(list.more.map(i => [i.id, i.step])).toEqual([['fbneo', 'install'], ['pcsx', 'get']]);
});

it('shows an NBT Manager update with the updates, and nothing of the car before one is paired', () => {
  const apps = catalog(online('manager', 'NBT Manager', ['0.5.5', '55']), online('doom', 'Doom', ['1.0.24', '24']));
  expect(appList(car([], ['0.5.4', '54']), [], apps, false).updates.map(i => i.id)).toEqual(['manager']);
  const none = appList(undefined, [held('doom', '1.0.24', '24')], apps, false);
  expect([none.updates, none.onCar, none.more.map(i => [i.id, i.step])]).toEqual([[], [], [['doom', 'none']]]);
});
