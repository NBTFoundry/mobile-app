// SPDX-License-Identifier: MPL-2.0
import { forgetCar, loadCars, rememberApps, rememberHealth, renameCar, saveCar, type CarRecord } from '../src/store/cars';
/** Delayed car reads must preserve edits and respect a forgotten pairing. */
const storage = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { storage.set(key, value); },
  deleteItemAsync: async (key: string) => { storage.delete(key); },
}));
jest.mock('../modules/car-link', () => ({ CarLink: {} }));

const car: CarRecord = {
  id: '0123456789abcdef', name: 'My car', ssid: 'DIRECT-car', passphrase: 'password',
  bssid: '02:11:22:33:44:55', address: '172.16.222.1:8080', keyAlias: 'car-0123456789abcdef',
  keyId: 'ab'.repeat(32), protection: 'tee',
};
const apps = [{ id: 'test', version: 'v2', sequence: '2', running: false }];
beforeEach(() => storage.clear());

it('preserves a rename when an outstanding application read completes', async () => {
  await saveCar(car, true);
  await Promise.all([renameCar(car.id, 'Renamed'), rememberApps(car.id, apps)]);
  expect((await loadCars()).cars[0]).toMatchObject({ name: 'Renamed', apps });
});
it('preserves fresh applications when a rename completes after a read', async () => {
  await saveCar(car, true);
  await Promise.all([rememberApps(car.id, apps), renameCar(car.id, 'Renamed')]);
  expect((await loadCars()).cars[0]).toMatchObject({ name: 'Renamed', apps });
});
it('never recreates a forgotten pairing when a read or rename completes', async () => {
  await saveCar(car, true);
  const [, remembered, renamed] = await Promise.all([
    forgetCar(car.id), rememberApps(car.id, apps), renameCar(car.id, 'Renamed'),
  ]);
  expect(remembered).toBeUndefined();
  expect(renamed).toBeUndefined();
  expect((await loadCars()).cars).toEqual([]);
  expect(storage.has(`car.${car.id}`)).toBe(false);
});
it('keeps both pairings when storage writes overlap', async () => {
  const other = { ...car, id: 'fedcba9876543210', keyAlias: 'car-fedcba9876543210' };
  await Promise.all([saveCar(car), saveCar(other, true)]);
  const loaded = await loadCars();
  expect(loaded.cars.map(item => item.id)).toEqual([car.id, other.id]);
  expect(loaded.selected).toBe(other.id);
});
it('keeps the theme the car showed last, and drops one it cannot read', async () => {
  await saveCar(car, true);
  await rememberApps(car.id, apps, undefined, 'supra');
  expect((await loadCars()).cars[0]!.theme).toBe('supra');
  // A read that did not get the theme (an older manager, a failure) leaves it.
  await rememberApps(car.id, apps);
  expect((await loadCars()).cars[0]!.theme).toBe('supra');
  storage.set(`car.${car.id}`, JSON.stringify({ ...car, theme: 'rolls' }));
  expect((await loadCars()).cars[0]).toMatchObject({ name: 'My car' });
  expect((await loadCars()).cars[0]!.theme).toBeUndefined();
});
it('keeps what was read of the car’s health, part by part, and drops a part it cannot read', async () => {
  await saveCar(car, true);
  await rememberHealth(car.id, { selfTest: { time: 1_700_000_000_000, passed: 12, failed: 1, skipped: 2 } });
  await rememberHealth(car.id, { crashes: { count: 3, seenAt: 1_700_000_100_000 } });
  // An application read between the two leaves it.
  await rememberApps(car.id, apps);
  expect((await loadCars()).cars[0]!.health).toEqual({
    selfTest: { time: 1_700_000_000_000, passed: 12, failed: 1, skipped: 2 }, crashes: { count: 3, seenAt: 1_700_000_100_000 } });
  storage.set(`car.${car.id}`, JSON.stringify({ ...car,
    health: { selfTest: { time: 'now', passed: 1, failed: 0, skipped: 0 }, crashes: { count: 2, seenAt: 5 } } }));
  expect((await loadCars()).cars[0]!.health).toEqual({ crashes: { count: 2, seenAt: 5 } });
  storage.set(`car.${car.id}`, JSON.stringify({ ...car, health: { crashes: { count: -1, seenAt: 5 } } }));
  expect((await loadCars()).cars[0]!.health).toBeUndefined();
});
