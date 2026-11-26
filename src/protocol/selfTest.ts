// SPDX-License-Identifier: MPL-2.0
/** The last self test's report, as the car keeps it (GET /v1/selftest; NBT Manager's
 * docs/self-test.md). Untrusted: bounded, and refused whole when malformed. */
import { ProtocolError, isU64 } from './bytes';
import { MAX_REPLY } from './replies';

export type SelfTestResult = 'pass' | 'fail' | 'skip';
export type SelfTestRow = { group: string; check: string; result: SelfTestResult; detail: string };
/** `time` in ms since the epoch, by the car's clock; `version` "-" when the release was not verified. */
export type SelfTestReport = { none: true } | { time: number; version: string; rows: SelfTestRow[] };

const MAX_ROWS = 64;
const NAME = /^[a-z]{1,12}$/;
const DETAIL = /^[\x20-\x7e]{0,40}$/;
const VERSION = /^([A-Za-z0-9._-]{1,48}|-)$/;
const RESULTS: Record<string, SelfTestResult> = { p: 'pass', f: 'fail', s: 'skip' };

const bad = (): never => {
  throw new ProtocolError('bad-reply');
};

export function parseSelfTest(text: string): SelfTestReport {
  if (text.length > MAX_REPLY || !text.endsWith('\n')) bad();
  const lines = text.slice(0, -1).split('\n');
  if (lines.length > MAX_ROWS + 1) bad();
  const head = lines[0]!.split('\t');
  if (head[0] !== 'SELFTEST1') bad();
  if (head.length === 2 && head[1] === 'none' && lines.length === 1) return { none: true };
  if (head.length !== 3 || !isU64(head[1]!, true) || head[1]!.length > 11 || !VERSION.test(head[2]!)) bad();
  const rows = lines.slice(1).map((line): SelfTestRow => {
    const fields = line.split('\t');
    const key = (fields[0] ?? '').split('.');
    const result = RESULTS[fields[1] ?? ''];
    if (fields.length !== 3 || key.length !== 2 || !NAME.test(key[0]!) || !NAME.test(key[1]!) || !result
      || !DETAIL.test(fields[2]!)) bad();
    return { group: key[0]!, check: key[1]!, result: result!, detail: fields[2]! };
  });
  return { time: Number(head[1]) * 1000, version: head[2]!, rows };
}

/** Failures first, then what was skipped, then what passed; the car's order within each. */
export function sortedRows(rows: readonly SelfTestRow[]): SelfTestRow[] {
  const rank: Record<SelfTestResult, number> = { fail: 0, skip: 1, pass: 2 };
  return rows.map((row, i) => ({ row, i })).sort((a, b) => rank[a.row.result] - rank[b.row.result] || a.i - b.i)
    .map(({ row }) => row);
}
