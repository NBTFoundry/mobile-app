// SPDX-License-Identifier: MPL-2.0
/** What the Car tab opens, a page each: the car's last self test, its crash reports, its logs.
 * What they find is kept with the car, for the Car tab's summaries. */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { fetchManagerLog, fetchSystemLog, type CarLog, type LogResult } from '../car/logs';
import type { CarTool } from '../route';
import { rememberHealth, type CarRecord } from '../store/cars';
import { Body, Busy, Label, Row, Title } from '../ui/kit';
import { t } from '../i18n';
import { CrashesPanel } from './CrashesPanel';
import { LogView } from './LogView';
import { SelfTestPanel } from './SelfTestPanel';

function Logs({ car }: { car: CarRecord }) {
  const [log, setLog] = useState<CarLog>();
  const [problem, setProblem] = useState<string>();
  const [reading, setReading] = useState(false);
  const read = async (fetch: (car: CarRecord) => Promise<LogResult>) => {
    setReading(true);
    const result = await fetch(car);
    setLog('log' in result ? result.log : undefined);
    setProblem('problem' in result ? result.problem : undefined);
    setReading(false);
  };
  return <>
    <View><Label>{car.name}</Label><Title>{t('car.logs')}</Title></View>
    {log ? <LogView log={log} onClose={() => setLog(undefined)} /> : <View>
      <Row title={t('car.idriveLog')} onPress={!reading ? () => void read(fetchSystemLog) : undefined} />
      <Row title={t('log.managerTitle')} onPress={!reading ? () => void read(fetchManagerLog) : undefined} />
    </View>}
    {reading ? <Busy text={t('common.gettingLog')} /> : null}
    {problem && !log ? <Body>{problem}</Body> : null}
  </>;
}

export function CarToolScreen({ state, car: current, tool }: { state: AppState; car: CarRecord; tool: CarTool }) {
  // The car as it was when the page opened: keeping what was read must not start another read.
  const [car] = useState(current);
  const keep = (part: Parameters<typeof rememberHealth>[1]) =>
    void rememberHealth(car.id, part).then(() => state.reloadCars());
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {tool === 'logs' ? <Logs car={car} />
        : tool === 'selfTest' ? <SelfTestPanel car={car} onClose={state.back} onRead={selfTest => keep({ selfTest })} />
          : <CrashesPanel car={car} onClose={state.back} onRead={count => keep({ crashes: { count, seenAt: Date.now() } })} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 20 },
});
