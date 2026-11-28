// SPDX-License-Identifier: MPL-2.0
/** An application's files on a car: read, sent from this phone, deleted (the phone asks first). */
import { CarLink } from '../../modules/car-link';
import { listFiles, removeFile, sendFile, type FileListing } from '../protocol/files';
import { CarError, LinkError, type Stop } from '../protocol/session';
import { updateActivity } from '../store/activity';
import type { CarRecord } from '../store/cars';
import { LibraryError } from '../store/library';
import { t, tn } from '../i18n';
import { act, onCarNetwork, reachWorker, stopFollowing } from './operations';

/** A file picked on the phone, in the app's cache, and the name the car stores it under. */
export type PickedFile = { uri: string; name: string };

/** The application's files; null when it takes none (or the car's manager has no files). */
export function loadFiles(car: CarRecord, app: string): Promise<FileListing | null | undefined> {
  return act(car.name, t('files.readTitle', { app }), t('common.joining'), (id, cancel) => onCarNetwork(car, async () => {
    const worker = await reachWorker(car, id, cancel);
    try {
      const listing = await listFiles(worker, app);
      return { value: listing, phase: 'done' as const, detail: tn('files.onCar', listing.count) };
    } catch (error) {
      if (!(error instanceof CarError && error.status === 404 && error.code === 'app')) throw error;
      return { value: null, phase: 'done' as const, detail: t('files.none') };
    }
  }, id));
}

/** Size and SHA-256, read on the phone before joining the car. */
async function measure(uri: string): Promise<{ size: number; sha256: string }> {
  try {
    const { size, sha256 } = await CarLink.inspect(uri, 0);
    return { size, sha256 };
  } catch {
    throw new LibraryError('unreadable');
  }
}

/**
 * Sends one file; `progress` follows its bytes. `stop` ends it at any point: before joining, while
 * joining (the join is abandoned), or mid-file (the car discards the part it received).
 */
export function uploadFile(car: CarRecord, app: string, picked: PickedFile, stop: Stop,
  progress?: (sent: number, total: number) => void): Promise<boolean | undefined> {
  let unbind: (() => void) | undefined;
  return act(car.name, t('files.sendTitle', { name: picked.name, app }), t('files.measuring'), async (id, cancel) => {
    if (stop.stopped) throw new LinkError('stopped');
    const file = await measure(picked.uri);
    updateActivity(id, { detail: t('common.joining') });
    return onCarNetwork(car, async () => {
      const worker = await reachWorker(car, id, cancel);
      if (stop.stopped) throw new LinkError('stopped');
      updateActivity(id, { detail: t('files.sending'), progress: 0, stage: 'transfer' });
      await sendFile(worker, app, picked.name, { uri: picked.uri, ...file }, (sent, total) => {
        updateActivity(id, { progress: total ? sent / total : 0 });
        progress?.(sent, total);
      }, stop);
      return { value: true, phase: 'done' as const, detail: t('files.sent') };
    }, id);
  }, id => { unbind = stop.bind(() => stopFollowing(id)); }).finally(() => unbind?.());
}

export function deleteFile(car: CarRecord, app: string, name: string): Promise<boolean | undefined> {
  return act(car.name, t('files.deleteTitle', { name, app }), t('common.joining'), (id, cancel) => onCarNetwork(car, async () => {
    await removeFile(await reachWorker(car, id, cancel), app, name);
    return { value: true, phase: 'done' as const, detail: t('files.deleted') };
  }, id));
}
