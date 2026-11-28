// SPDX-License-Identifier: MPL-2.0
/** The car's last self test (NBT Manager's Settings › Self test): what failed, what was skipped,
 * what passed, and the report shared as a text file. Read when the panel opens. */
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { fetchSelfTest, resultLabel, rowTitle, selfTestFile, type SelfTestRead } from '../car/selfTest';
import { sortedRows } from '../protocol/selfTest';
import type { CarHealth, CarRecord } from '../store/cars';
import { Body, Busy, Button, Label, Panel, Row, useColors } from '../ui/kit';
import { formatDateTime, t } from '../i18n';
import { share } from './LogView';

/** `onRead`: a run was read, with its counts. */
export function SelfTestPanel({ car, onClose, onRead }: {
  car: CarRecord; onClose: () => void; onRead?: (run: NonNullable<CarHealth['selfTest']>) => void;
}) {
  const colors = useColors();
  const [read, setRead] = useState<SelfTestRead>();
  const [round, setRound] = useState(0);
  const tell = useEffectEvent((run: NonNullable<CarHealth['selfTest']>) => onRead?.(run));
  useEffect(() => {
    let live = true;
    void fetchSelfTest(car).then(result => {
      if (!live) return;
      setRead(result);
      const report = 'report' in result && !('none' in result.report) ? result.report : undefined;
      if (report) {
        const of = (kind: string) => report.rows.filter(row => row.result === kind).length;
        tell({ time: report.time, passed: of('pass'), failed: of('fail'), skipped: of('skip') });
      }
    });
    return () => {
      live = false;
    };
  }, [car, round]);
  const report = read && 'report' in read && !('none' in read.report) ? read.report : undefined;
  const count = (result: string) => report?.rows.filter(row => row.result === result).length ?? 0;
  return (
    <Panel>
      <Label>{t('selfTest.title')}</Label>
      {!read ? <Busy text={t('selfTest.reading')} /> : null}
      {read && 'unsupported' in read ? <Body muted>{t('selfTest.unsupported')}</Body> : null}
      {read && 'problem' in read ? <Body>{read.problem}</Body> : null}
      {read && 'report' in read && 'none' in read.report ? <Body muted>{t('selfTest.none')}</Body> : null}
      {report ? <>
        <Body>{t('selfTest.summary', { passed: count('pass'), failed: count('fail'), skipped: count('skip') })}</Body>
        <Body muted>{t('selfTest.when', { time: formatDateTime(report.time), version: report.version })}</Body>
        <View>{sortedRows(report.rows).map((row, i) => (
          <Row key={`${row.group}.${row.check}.${i}`} title={rowTitle(row)} detail={row.detail || undefined}
            tag={resultLabel(row)}
            tagColor={row.result === 'fail' ? colors.bad : row.result === 'skip' ? colors.warn : colors.ok} />
        ))}</View>
      </> : null}
      <View style={styles.buttons}>
        {report ? <Button label={t('selfTest.share')} kind="plain"
          onPress={() => void share(selfTestFile(car, report))} /> : null}
        <Button label={t('crash.refresh')} kind="plain" disabled={!read}
          onPress={() => { setRead(undefined); setRound(r => r + 1); }} />
        <Button label={t('common.close')} kind="plain" onPress={onClose} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
