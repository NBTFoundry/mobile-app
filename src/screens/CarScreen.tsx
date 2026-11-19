/** Cached applications on the selected car. Connections begin with a user action. */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { useConnection } from '../car/connection';
import { fetchManagerLog, fetchSystemLog, type CarLog, type LogResult } from '../car/logs';
import { connectCar, refreshApps } from '../car/operations';
import type { CarRecord } from '../store/cars';
import { appLabel, newestFor, updateAvailable } from '../store/library';
import { Body, Busy, Button, Heading, Label, Panel, Row, Title, useColors, useStyles } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { LanguageRow } from '../ui/LanguageRow';
import { formatDateTime, t } from '../i18n';
import { LogView } from './LogView';

export function CarScreen({ state }: { state: AppState }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { car, library } = state;
  const connection = useConnection();
  const [menu, setMenu] = useState(false);
  const [log, setLog] = useState<CarLog>();
  const [logProblem, setLogProblem] = useState<string>();
  const [readingLog, setReadingLog] = useState(false);
  const [refreshProblem, setRefreshProblem] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!car) return;
    setRefreshing(true);
    setRefreshProblem(false);
    const updated = await refreshApps(car);
    if (updated) state.updateCar(updated);
    else setRefreshProblem(true);
    setRefreshing(false);
  };
  const readLog = async (fetch: (car: CarRecord) => Promise<LogResult>) => {
    if (!car) return;
    setMenu(false);
    setReadingLog(true);
    const result = await fetch(car);
    setLog('log' in result ? result.log : undefined);
    setLogProblem('problem' in result ? result.problem : undefined);
    setReadingLog(false);
  };
  if (!car) return (
    <ScrollView contentContainerStyle={styles.page}>
      <Title>{t('car.title')}</Title>
      <Panel>
        <Heading>{t('car.welcome')}</Heading>
        <Body muted>{t('car.welcomeBody')}</Body>
        <Button label={t('common.pairCar')} onPress={() => state.go({ tab: 'car', pairing: true })} />
      </Panel>
      <Row title={t('common.installNbt')} detail={t('car.installDetail')}
        onPress={() => state.go({ tab: 'car', installer: true })} />
      <LanguageRow />
      {__DEV__ ? <Row title={t('car.development')} onPress={() => state.go({ tab: 'car', cars: true })} /> : null}
    </ScrollView>
  );
  const apps = car.apps ?? [];
  const available = [...new Set(library.map(e => e.info.app))]
    .filter(app => !apps.some(a => a.id === app)).map(app => newestFor(library, app)!);
  const ours = !car.desk && connection.carId === car.id;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 200 }}><Label>{t('car.title')}</Label><Title>{car.name}</Title></View>
        <Button label={t('car.manage')} kind="plain" onPress={() => setMenu(true)} />
      </View>
      <Panel>
        {ours && connection.state === 'joining' ? <Busy text={t('common.connecting')} /> : (
          <Body muted>{car.desk ? t('car.desk') : ours && connection.state === 'connected'
            ? t('car.connected') : ours && connection.problem ? connection.problem : t('car.notConnected')}</Body>
        )}
        {car.appsSeenAt ? <Body muted>{t('car.lastRead', { time: formatDateTime(car.appsSeenAt) })}</Body> : null}
        <Button label={t(car.apps === undefined ? 'car.readApps' : 'car.refreshApps')} disabled={refreshing}
          onPress={() => void refresh()} />
        {refreshing ? <Busy text={t('car.readingApps')} /> : null}
      </Panel>
      {refreshProblem ? <Row title={t('car.readFailed')} detail={t('car.readFailedDetail')}
        onPress={() => state.go({ tab: 'activity' })} /> : null}
      <Label>{t('car.installed')}</Label>
      {car.apps === undefined ? <Body muted>{t('car.readToSee')}</Body>
        : !apps.length ? <Body muted>{t('car.noApps')}</Body> : null}
      <View>{apps.map(app => <Row key={app.id} title={appLabel(app.id)} detail={app.version}
        tag={updateAvailable(library, app) ? t('car.updateAvailable') : undefined} tagColor={colors.accent}
        onPress={() => state.go({ tab: 'car', app: app.id })} />)}</View>
      {available.length ? <><Label>{t('car.fromLibrary')}</Label><View>{available.map(entry => (
        <Row key={entry.info.app} title={appLabel(entry.info.app)} detail={entry.info.version}
          onPress={() => state.go({ tab: 'car', app: entry.info.app })} />
      ))}</View></> : null}
      {readingLog ? <Busy text={t('common.gettingLog')} /> : null}
      {log ? <LogView log={log} onClose={() => setLog(undefined)} /> : null}
      {logProblem && !log ? <Body>{logProblem}</Body> : null}
      {menu ? <Dialog title={car.name} onClose={() => setMenu(false)}>
        <Row title={t('car.switch')} onPress={() => { setMenu(false); state.go({ tab: 'car', cars: true }); }} />
        {!car.desk ? <Row title={t('car.connect')} onPress={() => { setMenu(false); void connectCar(car); }} /> : null}
        <Row title={t('car.idriveLog')} onPress={() => void readLog(fetchSystemLog)} />
        <Row title={t('car.managerLog')} onPress={() => void readLog(fetchManagerLog)} />
        <Row title={t('common.installNbt')} onPress={() => { setMenu(false); state.go({ tab: 'car', installer: true }); }} />
      </Dialog> : null}
    </ScrollView>
  );
}
const makeStyles = () => StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
