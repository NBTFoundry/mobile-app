// SPDX-License-Identifier: MPL-2.0
/** Developer keys on the car (PROTOCOL.md, "Developer keys"): listed from either listener,
 * added and removed through App Manager, each confirmed by the driver on the car. */
import { addKey, listKeys, removeKey } from '../protocol/actions';
import type { DeveloperKey } from '../protocol/developerKey';
import type { CarKey, Status } from '../protocol/replies';
import type { CarRecord } from '../store/cars';
import { t, tn } from '../i18n';
import { describeError } from './messages';
import { act, anyListener, follow, managerAction, onCarNetwork } from './operations';

/** `unsupported` from a manager that has no developer keys. */
export type KeyList = { keys: CarKey[] } | { unsupported: true } | { problem: string };

export function fetchKeys(car: CarRecord): Promise<KeyList> {
  return act<KeyList>(car.name, t('keys.title'), t('common.connecting'), async id => {
    try {
      return await onCarNetwork(car, async () => {
        const keys = await listKeys(await anyListener(car));
        if (!keys) return { value: { unsupported: true as const }, phase: 'done' as const, detail: t('keys.unsupported') };
        return { value: { keys }, phase: 'done' as const, detail: tn('keys.count', keys.length) };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: t('keys.failed') });
}

export function trustKey(car: CarRecord, name: string, key: DeveloperKey): Promise<Status | undefined> {
  return act(car.name, t('keys.addTitle', { name }), t('common.joining'), (id, cancel) => onCarNetwork(car, () =>
    managerAction(car, id, cancel, worker => addKey(worker, name, key, follow(id, cancel))), id));
}

export function forgetKey(car: CarRecord, key: CarKey): Promise<Status | undefined> {
  return act(car.name, t('keys.removeTitle', { name: key.name }), t('common.joining'), (id, cancel) =>
    onCarNetwork(car, () => managerAction(car, id, cancel, worker => removeKey(worker, key.id, follow(id, cancel))), id));
}
