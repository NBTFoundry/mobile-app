/** Logs read from the car (PROTOCOL.md, Logs): an application's own log, NBT Manager's
 * debug log and the iDrive system log. */
import { clearAppLog, readAppLog, readManagerLog, readSystemLog } from '../protocol/actions';
import type { CarSession, SavedReply } from '../protocol/session';
import type { CarRecord } from '../store/cars';
import { describeError } from './messages';
import { act, anyListener, onCarNetwork } from './operations';

/** `empty`: what to say when the car sent nothing. */
export type CarLog = SavedReply & { name: string; empty: string };
/** A log, or why it could not be read: shown where the reader asked for it. */
export type LogResult = { log: CarLog } | { problem: string };

function fetchLog(car: CarRecord, title: string, name: string,
  read: (session: CarSession) => Promise<SavedReply>): Promise<LogResult> {
  return act<LogResult>(car.name, title, 'Connecting…', async id => {
    try {
      return await onCarNetwork(car, async () => {
        const saved = await read(await anyListener(car));
        const empty = name === 'NBT Manager' ? 'No log. Turn on Debug log in App Manager’s settings.' : 'No log yet.';
        return { value: { log: { ...saved, name, empty } }, phase: 'done' as const, detail: saved.size ? 'Log received.' : empty };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: 'Could not get the log.' });
}

export function fetchAppLog(car: CarRecord, app: string): Promise<LogResult> {
  return fetchLog(car, `Log of ${app}`, app, session => readAppLog(session, app));
}

export function fetchSystemLog(car: CarRecord): Promise<LogResult> {
  return fetchLog(car, 'iDrive log', 'iDrive', readSystemLog);
}

export function fetchManagerLog(car: CarRecord): Promise<LogResult> {
  return fetchLog(car, 'NBT Manager log', 'NBT Manager', readManagerLog);
}

export function clearLog(car: CarRecord, app: string): Promise<boolean | undefined> {
  return act(car.name, `Clear the log of ${app}`, 'Connecting…', async id =>
    onCarNetwork(car, async () => {
      await clearAppLog(await anyListener(car), app);
      return { value: true, phase: 'done' as const, detail: 'Log cleared.' };
    }, id));
}
