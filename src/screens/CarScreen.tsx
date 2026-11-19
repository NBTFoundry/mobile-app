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
      <Title>Car</Title>
      <Panel>
        <Heading>Your car, connected</Heading>
        <Body muted>Pair this phone to manage your car’s applications.</Body>
        <Button label="Pair a car" onPress={() => state.go({ tab: 'car', pairing: true })} />
      </Panel>
      <Row title="Install NBT Manager on a car" detail="Set up a car using a Wi-Fi ENET adapter"
        onPress={() => state.go({ tab: 'car', installer: true })} />
      {__DEV__ ? <Row title="Development" onPress={() => state.go({ tab: 'car', cars: true })} /> : null}
    </ScrollView>
  );
  const apps = car.apps ?? [];
  const available = [...new Set(library.map(e => e.info.app))]
    .filter(app => !apps.some(a => a.id === app)).map(app => newestFor(library, app)!);
  const ours = !car.desk && connection.carId === car.id;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 200 }}><Label>Car</Label><Title>{car.name}</Title></View>
        <Button label="Manage" kind="plain" onPress={() => setMenu(true)} />
      </View>
      <Panel>
        {ours && connection.state === 'joining' ? <Busy text="Connecting…" /> : (
          <Body muted>{car.desk ? 'Desk connection' : ours && connection.state === 'connected'
            ? 'Connected' : ours && connection.problem ? connection.problem : 'Not connected'}</Body>
        )}
        {car.appsSeenAt ? <Body muted>{`Last read ${new Date(car.appsSeenAt).toLocaleString()}`}</Body> : null}
        <Button label={car.apps === undefined ? 'Read applications' : 'Refresh applications'} disabled={refreshing}
          onPress={() => void refresh()} />
        {refreshing ? <Busy text="Reading applications…" /> : null}
      </Panel>
      {refreshProblem ? <Row title="Couldn’t read applications" detail="View Activity for details"
        onPress={() => state.go({ tab: 'activity' })} /> : null}
      <Label>Installed</Label>
      {car.apps === undefined ? <Body muted>Read the applications to see what’s installed.</Body>
        : !apps.length ? <Body muted>No applications installed.</Body> : null}
      <View>{apps.map(app => <Row key={app.id} title={appLabel(app.id)} detail={app.version}
        tag={updateAvailable(library, app) ? 'Update available' : undefined} tagColor={colors.accent}
        onPress={() => state.go({ tab: 'car', app: app.id })} />)}</View>
      {available.length ? <><Label>From your library</Label><View>{available.map(entry => (
        <Row key={entry.info.app} title={appLabel(entry.info.app)} detail={entry.info.version}
          onPress={() => state.go({ tab: 'car', app: entry.info.app })} />
      ))}</View></> : null}
      {readingLog ? <Busy text="Getting the log…" /> : null}
      {log ? <LogView log={log} onClose={() => setLog(undefined)} /> : null}
      {logProblem && !log ? <Body>{logProblem}</Body> : null}
      {menu ? <Dialog title={car.name} onClose={() => setMenu(false)}>
        <Row title="Switch or manage cars" onPress={() => { setMenu(false); state.go({ tab: 'car', cars: true }); }} />
        {!car.desk ? <Row title="Connect" onPress={() => { setMenu(false); void connectCar(car); }} /> : null}
        <Row title="iDrive log" onPress={() => void readLog(fetchSystemLog)} />
        <Row title="Manager log" onPress={() => void readLog(fetchManagerLog)} />
        <Row title="Install NBT Manager on a car" onPress={() => { setMenu(false); state.go({ tab: 'car', installer: true }); }} />
      </Dialog> : null}
    </ScrollView>
  );
}
const makeStyles = () => StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
