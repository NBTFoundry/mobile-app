import { forgetCar, loadCars, rememberApps, renameCar, saveCar, type CarRecord } from '../src/store/cars';
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
