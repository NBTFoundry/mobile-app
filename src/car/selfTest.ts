// SPDX-License-Identifier: MPL-2.0
/** The car's last self test (NBT Manager's Settings › Self test, docs/self-test.md): read, and
 * shared as a text file. */
import { File, Paths } from 'expo-file-system';
import { readSelfTest } from '../protocol/actions';
import { sortedRows, type SelfTestReport, type SelfTestRow } from '../protocol/selfTest';
import type { CarRecord } from '../store/cars';
import { formatDateTime, t, type Key } from '../i18n';
import { describeError } from './messages';
import { act, anyListener, onCarNetwork } from './operations';

export type SelfTestRead = { report: SelfTestReport } | { unsupported: true } | { problem: string };

const GROUPS: Record<string, Key> = {
  manager: 'selfTest.group.manager', native: 'selfTest.group.native', guest: 'selfTest.group.guest',
  module: 'selfTest.group.module', you: 'selfTest.group.you',
};
const CHECKS: Record<string, Key> = {
  release: 'selfTest.check.release', runner: 'selfTest.check.runner', files: 'selfTest.check.files',
  space: 'selfTest.check.space', start: 'selfTest.check.start', bridge: 'selfTest.check.bridge',
  screen: 'selfTest.check.screen', sound: 'selfTest.check.sound', status: 'selfTest.check.status',
  cardata: 'selfTest.check.cardata', diag: 'selfTest.check.diag', phone: 'selfTest.check.phone',
  controller: 'selfTest.check.controller',
};

/** "Module: controller"; a group or check this app does not know keeps the car's name. */
export function rowTitle(row: SelfTestRow): string {
  const group = GROUPS[row.group];
  const check = CHECKS[row.check];
  return t('selfTest.rowTitle', { group: group ? t(group) : row.group, check: check ? t(check) : row.check });
}

export const resultLabel = (row: SelfTestRow) =>
  t(row.result === 'fail' ? 'selfTest.failed' : row.result === 'skip' ? 'selfTest.skipped' : 'selfTest.passed');

export function fetchSelfTest(car: CarRecord): Promise<SelfTestRead> {
  return act<SelfTestRead>(car.name, t('selfTest.title'), t('common.connecting'), async id => {
    try {
      return await onCarNetwork(car, async () => {
        const report = await readSelfTest(await anyListener(car));
        if (!report) return { value: { unsupported: true as const }, phase: 'done' as const, detail: t('selfTest.unsupported') };
        return { value: { report }, phase: 'done' as const, detail: t('selfTest.read') };
      }, id);
    } catch (error) {
      const problem = describeError(error);
      return { value: { problem }, phase: 'failed' as const, detail: problem };
    }
  }).then(result => result ?? { problem: t('selfTest.readFailed') });
}

/** The report as text in the phone's language, every check, failures first: a file to share. */
export function selfTestFile(car: CarRecord, report: Exclude<SelfTestReport, { none: true }>): string {
  const lines = [t('selfTest.shareHead', { car: car.name }), t('selfTest.when', { time: formatDateTime(report.time),
    version: report.version }), ''];
  for (const row of sortedRows(report.rows)) {
    lines.push(`${resultLabel(row)}: ${rowTitle(row)}${row.detail ? ` (${row.detail})` : ''}`);
  }
  const file = new File(Paths.cache, `self-test-${Math.floor(Date.now() / 1000)}.txt`);
  file.write(`${lines.join('\n')}\n`);
  return file.uri;
}
