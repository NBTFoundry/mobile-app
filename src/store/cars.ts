// SPDX-License-Identifier: MPL-2.0
/** Paired cars, one SecureStore entry each, plus an index. Stored data is checked when read. */
import * as SecureStore from 'expo-secure-store';
import { isCarTheme, parseApps, parseManager, type CarApp, type CarManager, type CarTheme } from '../protocol/replies';
import { isHostPort } from '../protocol/signing';
import type { Protection } from '../../modules/device-key';
import { CarLink } from '../../modules/car-link';

export type CarRecord = {
  id: string;
  name: string;
  /** Empty for a desk car reached through the workstation in a debug build. */
  ssid: string;
  passphrase: string;
  bssid: string;
  address: string;
  keyAlias: string;
  keyId: string;
  protection: Protection;
  desk?: string;
  apps?: CarApp[];
  appsSeenAt?: number;
  /** Read with the apps; null: its manager predates `GET /v1/manager` (reads releases up to NBTRLS2). */
  manager?: CarManager | null;
  /** Read with the apps: the theme its screen shows; unset from a manager without `GET /v1/theme` (BMW's). */
  theme?: CarTheme;
};

type Index = { ids: string[]; selected?: string };

const INDEX = 'cars.index';
const entry = (id: string) => `car.${id}`;
const ID = /^[0-9a-f]{16}$/;

function str(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length <= max ? value : undefined;
}

/** Rebuilds a record from stored JSON, or returns undefined when anything is off. */
export function checkRecord(raw: unknown): CarRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 16), name = str(r.name, 40), ssid = str(r.ssid, 32), passphrase = str(r.passphrase, 63);
  const bssid = str(r.bssid, 17), address = str(r.address, 21), keyAlias = str(r.keyAlias, 20), keyId = str(r.keyId, 64);
  const protection = r.protection;
  if (!id || !ID.test(id) || !name || ssid === undefined || passphrase === undefined || !bssid || !address
    || !isHostPort(address) || keyAlias !== `car-${id}` || !keyId || !/^[0-9a-f]{64}$/.test(keyId)
    || (protection !== 'strongbox' && protection !== 'tee' && protection !== 'software')) return undefined;
  const record: CarRecord = { id, name, ssid, passphrase, bssid, address, keyAlias, keyId, protection };
  const desk = str(r.desk, 15);
  if (desk) record.desk = desk;
  if (Array.isArray(r.apps) && r.apps.length <= 16 && typeof r.appsSeenAt === 'number') {
    try {
      const apps = r.apps as CarApp[];
      record.apps = parseApps(`APPS\t${apps.length}\n` + apps.map(a =>
        `${a.id}\t${a.version}\t${a.sequence}\t${a.running ? 1 : 0}\n`).join(''));
      record.appsSeenAt = r.appsSeenAt;
    } catch {
      // Drop an unreadable list; the next session refreshes it.
    }
  }
  if (r.manager === null) record.manager = null;
  else if (r.manager && typeof r.manager === 'object') {
    try {
      const m = r.manager as CarManager;
      record.manager = parseManager(`MANAGER\t${m.version}\t${m.sequence}\t${m.formats.map(f => `NBTRLS${f}`).join(',')}\n`);
    } catch {
      // Read again with the apps.
    }
  }
  if (isCarTheme(r.theme)) record.theme = r.theme;
  return record;
}

async function readIndex(): Promise<Index> {
  try {
    const raw = JSON.parse((await SecureStore.getItemAsync(INDEX)) ?? '{}') as Partial<Index>;
    const ids = Array.isArray(raw.ids) ? raw.ids.filter((x): x is string => typeof x === 'string' && ID.test(x)) : [];
    const selected = typeof raw.selected === 'string' && ids.includes(raw.selected) ? raw.selected : undefined;
    return { ids: [...new Set(ids)], selected };
  } catch {
    return { ids: [] };
  }
}

const writeIndex = (index: Index) => SecureStore.setItemAsync(INDEX, JSON.stringify(index));

export async function loadCars(): Promise<{ cars: CarRecord[]; selected?: string }> {
  const index = await readIndex();
  const cars: CarRecord[] = [];
  for (const id of index.ids) {
    try {
      const record = checkRecord(JSON.parse((await SecureStore.getItemAsync(entry(id))) ?? 'null'));
      if (record) cars.push(record);
    } catch {
      // Skip an unreadable entry; it can be paired again.
    }
  }
  const selected = cars.some(c => c.id === index.selected) ? index.selected : cars[0]?.id;
  return { cars, selected };
}

let writes: Promise<unknown> = Promise.resolve();
function mutate<T>(run: () => Promise<T>): Promise<T> {
  const next = writes.then(run, run);
  writes = next.catch(() => undefined);
  return next;
}

export function saveCar(car: CarRecord, select = false): Promise<void> {
  return mutate(async () => {
    await SecureStore.setItemAsync(entry(car.id), JSON.stringify(car));
    const index = await readIndex();
    if (!index.ids.includes(car.id)) index.ids.push(car.id);
    if (select) index.selected = car.id;
    await writeIndex(index);
  });
}

export function selectCar(id: string): Promise<void> {
  return mutate(async () => {
    const index = await readIndex();
    if (index.ids.includes(id)) await writeIndex({ ...index, selected: id });
  });
}

export function forgetCar(id: string): Promise<void> {
  return mutate(async () => {
    const index = await readIndex();
    await writeIndex({ ids: index.ids.filter(x => x !== id),
      selected: index.selected === id ? undefined : index.selected });
    await SecureStore.deleteItemAsync(entry(id));
  });
}

/** 16 hex digits from the platform's SecureRandom. */
export function newCarId(): string {
  return CarLink.randomHex(8);
}

/** Merge delayed results into the latest record, never recreating a forgotten car. */
function patchCar(id: string, patch: Partial<Pick<CarRecord, 'name' | 'apps' | 'appsSeenAt' | 'manager' | 'theme'>>): Promise<CarRecord | undefined> {
  return mutate(async () => {
    const { cars } = await loadCars();
    const current = cars.find(car => car.id === id);
    if (!current) return undefined;
    const updated = { ...current, ...patch };
    await SecureStore.setItemAsync(entry(id), JSON.stringify(updated));
    return updated;
  });
}
export const renameCar = (id: string, name: string) => patchCar(id, { name });
/** `manager` or `theme` undefined: not read this time, the stored one stays. */
export const rememberApps = (id: string, apps: CarApp[], manager?: CarManager | null, theme?: CarTheme) =>
  patchCar(id, { apps, appsSeenAt: Date.now(), ...(manager !== undefined ? { manager } : {}), ...(theme ? { theme } : {}) });
