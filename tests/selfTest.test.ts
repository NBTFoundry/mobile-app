// SPDX-License-Identifier: MPL-2.0
import { parseSelfTest, sortedRows } from '../src/protocol/selfTest';

describe('self test report', () => {
  const report = 'SELFTEST1\t1795680000\tdev145\nmanager.release\tp\tdev145\nmodule.controller\tf\tno turn in 15 s\n'
    + 'native.diag\ts\tno gateway\nyou.sound\tp\tyes\n';

  it('reads the report the car keeps', () => {
    const parsed = parseSelfTest(report);
    expect(parsed).toEqual({ time: 1795680000000, version: 'dev145', rows: [
      { group: 'manager', check: 'release', result: 'pass', detail: 'dev145' },
      { group: 'module', check: 'controller', result: 'fail', detail: 'no turn in 15 s' },
      { group: 'native', check: 'diag', result: 'skip', detail: 'no gateway' },
      { group: 'you', check: 'sound', result: 'pass', detail: 'yes' },
    ] });
    if ('none' in parsed) throw new Error('no report');
    expect(sortedRows(parsed.rows).map(r => r.check)).toEqual(['controller', 'diag', 'release', 'sound']);
  });

  it('knows when none has run, and an unverified release', () => {
    expect(parseSelfTest('SELFTEST1\tnone\n')).toEqual({ none: true });
    expect(parseSelfTest('SELFTEST1\t0\t-\n')).toEqual({ time: 0, version: '-', rows: [] });
  });

  it.each([
    '', 'SELFTEST1\tnone', 'SELFTEST2\tnone\n', 'SELFTEST1\tnone\nmanager.release\tp\tx\n',
    'SELFTEST1\t12\n', 'SELFTEST1\t-1\tv1\n', 'SELFTEST1\t123456789012\tv1\n', 'SELFTEST1\t1\tv 1\n',
    'SELFTEST1\t1\tv1\nmanager\tp\tx\n', 'SELFTEST1\t1\tv1\nManager.release\tp\tx\n',
    'SELFTEST1\t1\tv1\nmanager.release\tok\tx\n', 'SELFTEST1\t1\tv1\nmanager.release\tp\n',
    `SELFTEST1\t1\tv1\nmanager.release\tp\t${'x'.repeat(41)}\n`, 'SELFTEST1\t1\tv1\nmanager.release\tp\t\x01\n',
    `SELFTEST1\t1\tv1\n${'manager.release\tp\tx\n'.repeat(65)}`, `SELFTEST1\t1\tv1\n${'a'.repeat(4100)}\n`,
  ])('refuses a malformed reply %#', text => expect(() => parseSelfTest(text)).toThrow());
});
