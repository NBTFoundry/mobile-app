// SPDX-License-Identifier: MPL-2.0
/** An application's phone page (the manager's docs/companion-bridge.md): opened as an action,
 * then read again every 2 s while shown and tapped, without an activity entry each. */
import { readCompanion, sendCompanionEvent } from '../protocol/actions';
import type { CompanionPage } from '../protocol/companion';
import { LinkError, type CarSession } from '../protocol/session';
import type { CarRecord } from '../store/cars';
import { t } from '../i18n';
import { describeError } from './messages';
import { act, anyListener, onCarNetwork } from './operations';
import { serialized } from './queue';

export const COMPANION_POLL_MS = 2000;

/** `unsupported`: no page (an application without one, or an older manager). */
export type CompanionResult = { page: CompanionPage } | { unsupported: true } | { problem: string };

/** The listener that answered last, per car: polls skip finding it again. */
const listeners = new Map<string, CarSession>();

/** Runs on the listener that answered last; when it is gone (App Manager closed or
 * opened), on whichever answers now. */
async function onListener<T>(car: CarRecord, run: (session: CarSession) => Promise<T>): Promise<T> {
  const last = listeners.get(car.id);
  if (last) {
    try {
      return await run(last);
    } catch (error) {
      listeners.delete(car.id);
      if (!(error instanceof LinkError)) throw error;
    }
  }
  const session = await anyListener(car);
  const result = await run(session);
  listeners.set(car.id, session);
  return result;
}

const read = (car: CarRecord, app: string): Promise<CompanionResult> =>
  onListener(car, async session => {
    const page = await readCompanion(session, app);
    return page ? { page } : { unsupported: true as const };
  });

export function openCompanion(car: CarRecord, app: string): Promise<CompanionResult> {
  listeners.delete(car.id);
  return act<CompanionResult>(car.name, t('companion.title'), t('common.connecting'), async id => {
    try {
      return await onCarNetwork(car, async () => {
        const result = await read(car, app);
        const detail = 'page' in result ? t(result.page.on ? 'companion.shown' : 'companion.notRunning')
          : t('companion.unsupported');
        return { value: result, phase: 'done' as const, detail };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: t('companion.failed') });
}

/** Reads the page again (no activity entry). */
export function refreshCompanion(car: CarRecord, app: string): Promise<CompanionResult> {
  return serialized(() => onCarNetwork(car, () => read(car, app)))
    .catch(error => ({ problem: describeError(error) }));
}

/** Sends a tap; its problem, or undefined once the car has it. */
export function tapCompanion(car: CarRecord, app: string, id: string, value: string): Promise<string | undefined> {
  return serialized(() => onCarNetwork(car, () => onListener(car, session => sendCompanionEvent(session, app, id, value))))
    .then(() => undefined, error => describeError(error));
}
