// SPDX-License-Identifier: MPL-2.0
/** One list of applications from the three places that know about them: what the car runs,
 * the packages downloaded to this phone, and the online catalog. Each application appears once,
 * with its next step. No React here: tests use it. */
import { compareU64 } from '../protocol/bytes';
import type { CarRecord } from './cars';
import { releaseFor, type Catalog, type CatalogApp, type CatalogRelease } from './catalog';
import { appLabel, newestFor, type LibraryEntry } from './library';

/** `get`: download the newer release; `install` and `update`: send the downloaded package to
 * the car; `none`: nothing to do. */
export type Step = 'get' | 'install' | 'update' | 'none';

export type AppItem = {
  id: string;
  /** The catalog's name, else the application id. */
  name: string;
  entry?: CatalogApp;
  /** What the car runs; NBT Manager's is unknown on a car that does not say. */
  installed?: { version: string; sequence: string };
  /** On the selected car: installed, or NBT Manager itself. */
  onCar: boolean;
  /** The newest package of it on this phone. */
  held?: LibraryEntry;
  /** The catalog's release, when newer than the car's and the phone's. */
  online?: CatalogRelease;
  step: Step;
  /** The version `step` leads to. */
  target?: string;
};

export type AppList = { updates: AppItem[]; onCar: AppItem[]; more: AppItem[] };

const newer = (a: string, b: string | undefined) => b === undefined || compareU64(a, b) > 0;

export function appItem(id: string, car: CarRecord | undefined, library: LibraryEntry[],
  catalog: Catalog | undefined, betas: boolean): AppItem {
  const manager = id === 'manager';
  const entry = catalog?.apps.find(a => a.id === id);
  const offered = entry && releaseFor(entry, betas);
  const installed = manager ? car?.manager ?? undefined : car?.apps?.find(a => a.id === id);
  const onCar = !!car && (manager || !!installed);
  const held = newestFor(library, id);
  // A car that does not say which NBT Manager it runs is offered the newest release.
  const online = offered && newer(offered.sequence, installed?.sequence) && newer(offered.sequence, held?.info.sequence)
    ? offered : undefined;
  const send = held && newer(held.info.sequence, installed?.sequence);
  const step: Step = online ? 'get' : !car || !send ? 'none' : onCar ? 'update' : 'install';
  return { id, entry, installed, onCar, held, online, step, name: entry?.name ?? appLabel(id),
    target: step === 'get' ? online?.version : step === 'none' ? undefined : held?.info.version };
}

/** Updates first (NBT Manager's too), then what the car runs, then what can be added to it. */
export function appList(car: CarRecord | undefined, library: LibraryEntry[], catalog: Catalog | undefined,
  betas: boolean): AppList {
  const ids = [...new Set([
    'manager',
    ...(car?.apps ?? []).map(a => a.id),
    ...library.map(e => e.info.app),
    ...(catalog?.apps ?? []).filter(a => releaseFor(a, betas)).map(a => a.id),
  ])];
  const list: AppList = { updates: [], onCar: [], more: [] };
  for (const item of ids.map(id => appItem(id, car, library, catalog, betas))) {
    if (item.onCar && item.step !== 'none') list.updates.push(item);
    // NBT Manager is the car's own: it shows here only with an update, else on the Car tab.
    else if (item.id === 'manager') continue;
    else if (item.onCar) list.onCar.push(item);
    else list.more.push(item);
  }
  // What is already downloaded comes first among what the car lacks.
  list.more.sort((a, b) => Number(!!b.held) - Number(!!a.held));
  return list;
}
