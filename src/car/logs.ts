// SPDX-License-Identifier: MPL-2.0
/** Logs read from the car (PROTOCOL.md, Logs): an application's own log, NBT Manager's
 * debug log and the iDrive system log. */
import { clearAppLog, readAppLog, readManagerLog, readSystemLog } from '../protocol/actions';
import type { CarSession, SavedReply } from '../protocol/session';
import type { CarRecord } from '../store/cars';
import { t } from '../i18n';
import { describeError } from './messages';
import { act, anyListener, onCarNetwork } from './operations';

/** `empty`: what to say when the car sent nothing. */
export type CarLog = SavedReply & { name: string; empty: string };
/** A log, or why it could not be read: shown where the reader asked for it. */
export type LogResult = { log: CarLog } | { problem: string };

function fetchLog(car: CarRecord, title: string, name: string,
  read: (session: CarSession) => Promise<SavedReply>): Promise<LogResult> {
  return act<LogResult>(car.name, title, t('common.connecting'), async id => {
    try {
      return await onCarNetwork(car, async () => {
        const saved = await read(await anyListener(car));
        const empty = t(name === 'NBT Manager' ? 'log.noManagerLog' : 'log.none');
        return { value: { log: { ...saved, name, empty } }, phase: 'done' as const,
          detail: saved.size ? t('log.received') : empty };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: t('log.failed') });
}

export function fetchAppLog(car: CarRecord, app: string): Promise<LogResult> {
  return fetchLog(car, t('log.ofApp', { app }), app, session => readAppLog(session, app));
}

export function fetchSystemLog(car: CarRecord): Promise<LogResult> {
  return fetchLog(car, t('car.idriveLog'), 'iDrive', readSystemLog);
}

export function fetchManagerLog(car: CarRecord): Promise<LogResult> {
  return fetchLog(car, t('log.managerTitle'), 'NBT Manager', readManagerLog);
}

export function clearLog(car: CarRecord, app: string): Promise<boolean | undefined> {
  return act(car.name, t('log.clearTitle', { app }), t('common.connecting'), async id =>
    onCarNetwork(car, async () => {
      await clearAppLog(await anyListener(car), app);
      return { value: true, phase: 'done' as const, detail: t('log.cleared') };
    }, id));
}
