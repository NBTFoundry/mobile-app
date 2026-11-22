// SPDX-License-Identifier: MPL-2.0
/** Crash reports kept on the car (PROTOCOL.md, "Crash reports"): listed, read one at a time or
 * all in one file to share, and cleared. */
import { File, Paths } from 'expo-file-system';
import { clearCrashes, listCrashes, readCrash } from '../protocol/actions';
import type { CarCrash } from '../protocol/replies';
import type { CarRecord } from '../store/cars';
import { appLabel } from '../store/library';
import { t, tn } from '../i18n';
import { fetchLog, type LogResult } from './logs';
import { describeError } from './messages';
import { act, anyListener, onCarNetwork } from './operations';

/** The car's reports, newest first; `unsupported` from a manager that keeps none. */
export type CrashList = { crashes: CarCrash[] } | { unsupported: true } | { problem: string };

export const crashTitle = (crash: CarCrash) =>
  t('crash.reportTitle', { app: appLabel(crash.app), time: crash.time || '?' });

/** All applications' reports (NBT Manager's too), or `app`'s. */
export function fetchCrashes(car: CarRecord, app?: string): Promise<CrashList> {
  const title = app ? t('crash.ofApp', { app: appLabel(app) }) : t('crash.title');
  return act<CrashList>(car.name, title, t('common.connecting'), async id => {
    try {
      return await onCarNetwork(car, async () => {
        const crashes = await listCrashes(await anyListener(car), app);
        if (!crashes) return { value: { unsupported: true as const }, phase: 'done' as const, detail: t('crash.unsupported') };
        return { value: { crashes }, phase: 'done' as const, detail: tn('crash.count', crashes.length) };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: t('crash.failed') });
}

/** One report, shown like a log. */
export function fetchCrash(car: CarRecord, crash: CarCrash): Promise<LogResult> {
  const title = crashTitle(crash);
  return fetchLog(car, title, crash.app, session => readCrash(session, crash), t('crash.empty'))
    .then(result => 'log' in result ? { log: { ...result.log, title } } : result);
}

/** Every report listed, in one file to share: the newest first, as listed. */
export function fetchAllCrashes(car: CarRecord, crashes: CarCrash[]): Promise<{ uri: string } | { problem: string }> {
  return act<{ uri: string } | { problem: string }>(car.name, t('crash.allTitle'), t('common.connecting'), async id => {
    try {
      return await onCarNetwork(car, async () => {
        const session = await anyListener(car);
        const parts: string[] = [];
        for (const crash of crashes) {
          parts.push(await new File((await readCrash(session, crash)).uri).text());
        }
        const file = new File(Paths.cache, `crash-reports-${Math.floor(Date.now() / 1000)}.txt`);
        file.write(parts.join(`\n${'='.repeat(72)}\n\n`));
        return { value: { uri: file.uri }, phase: 'done' as const, detail: tn('crash.count', crashes.length) };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: t('crash.failed') });
}

/** Removes the reports: all, or `app`'s. */
export function clearCrashReports(car: CarRecord, app?: string): Promise<boolean | undefined> {
  return act(car.name, t('crash.clearTitle'), t('common.connecting'), async id =>
    onCarNetwork(car, async () => {
      await clearCrashes(await anyListener(car), app);
      return { value: true, phase: 'done' as const, detail: t('crash.cleared') };
    }, id));
}
