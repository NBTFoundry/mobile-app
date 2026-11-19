/** An application's packages, settings and maintenance on a specific car. */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { clearLog, fetchAppLog, type CarLog } from '../car/logs';
import { applySetting, install, loadSettings, uninstall } from '../car/operations';
import { compareU64 } from '../protocol/bytes';
import type { Setting } from '../protocol/replies';
import type { CarRecord } from '../store/cars';
import { appLabel } from '../store/library';
import { Body, Busy, Button, Label, Panel, Row, Title } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { LogView } from './LogView';

export function AppScreen({ state, car, appId }: { state: AppState; car: CarRecord; appId: string }) {
  const [settings, setSettings] = useState<Setting[]>();
  const [choosing, setChoosing] = useState<Setting>();
  const [menu, setMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [log, setLog] = useState<CarLog>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [versions, setVersions] = useState(false);
  const installed = car.apps?.find(a => a.id === appId);
  const manager = appId === 'manager';
  const packages = state.library.filter(e => e.info.app === appId)
    .sort((a, b) => compareU64(b.info.sequence, a.info.sequence));
  const latest = packages[0];
  const canInstall = latest && (manager || !installed || compareU64(latest.info.sequence, installed.sequence) > 0);
  const after = async (run: Promise<unknown>) => {
    state.go({ tab: 'activity' });
    await run;
    await state.reloadCars();
  };
  const readSettings = async () => {
    setBusy('Reading settings…'); setProblem(undefined);
    const result = await loadSettings(car, appId);
    setSettings(result);
    if (!result) setProblem('Couldn’t read settings. See Activity for details.');
    setBusy(undefined);
  };
  const readLog = async () => {
    setMenu(false); setBusy('Getting the log…'); setProblem(undefined);
    const result = await fetchAppLog(car, appId);
    setLog('log' in result ? result.log : undefined);
    setProblem('problem' in result ? result.problem : undefined);
    setBusy(undefined);
  };
  const emptyLog = async () => {
    setBusy('Clearing the log…');
    if (log && await clearLog(car, appId)) setLog({ ...log, size: 0, tail: '' });
    else setProblem('Couldn’t clear the log. See Activity for details.');
    setBusy(undefined);
  };
  const choose = async (setting: Setting, value: string) => {
    setChoosing(undefined); setBusy('Saving setting…'); setProblem(undefined);
    if (await applySetting(car, appId, setting, value)) {
      setSettings(list => list?.map(s => s.key === setting.key ? { ...s, value } : s));
    } else setProblem('Couldn’t save the setting. See Activity for details.');
    setBusy(undefined);
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 200 }}><Label>{car.name}</Label><Title>{appLabel(appId)}</Title></View>
      {installed && !manager ? <Button label="More" kind="plain" onPress={() => setMenu(true)} /> : null}
    </View>
    <Panel>
      <Body muted>{installed ? `Installed ${installed.version}` : manager ? 'NBT Manager update' : 'Ready to install'}</Body>
      {canInstall ? <>
        <Body>{`Available ${latest.info.version}`}</Body>
        <Button label={`${manager || installed ? 'Update to' : 'Install'} ${latest.info.version}`}
          onPress={() => void after(install(car, latest))} />
        <Body muted>Confirm the request on the car.</Body>
      </> : <>
        <Body muted>{latest && installed ? 'No newer version in your library.' : 'Add a package in Library to continue.'}</Body>
        <Button label="Open Library" kind="plain" onPress={() => state.go({ tab: 'library' })} />
      </>}
    </Panel>
    {packages.length ? <>
      <Row title="Package versions" expanded={versions} detail={`${packages.length} in your library`}
        onPress={() => setVersions(!versions)} />
      {versions ? <View>{packages.map(entry => {
        const order = installed ? compareU64(entry.info.sequence, installed.sequence) : 1;
        const eligible = manager || order > 0;
        return <Row key={entry.sha256} title={entry.info.version}
          detail={`Sequence ${entry.info.sequence}`}
          tag={eligible ? (installed || manager ? 'Update' : 'Install') : order === 0 ? 'Installed' : 'Older'}
          onPress={eligible ? () => void after(install(car, entry)) : undefined} />;
      })}</View> : null}
    </> : null}
    {installed && !manager ? <>
      <Label>Settings</Label>
      {settings === undefined ? <Row title="Read settings" detail="Connect to see the current values"
        onPress={!busy ? () => void readSettings() : undefined} />
        : settings.length === 0 ? <Body muted>This application has no settings.</Body>
          : <View>{settings.map(setting => <Row key={setting.key} title={setting.label} detail={setting.value}
            onPress={!busy ? () => setChoosing(setting) : undefined} />)}</View>}
    </> : null}
    {busy ? <Busy text={busy} /> : null}
    {problem ? <><Body>{problem}</Body><Button label="View Activity" kind="plain" onPress={() => state.go({ tab: 'activity' })} /></> : null}
    {log ? <LogView log={log} onClose={() => setLog(undefined)} onClear={!busy ? () => void emptyLog() : undefined} /> : null}
    {choosing ? <Dialog title={choosing.label} onClose={() => setChoosing(undefined)}>
      {choosing.choices.map(value => <Row key={value} title={value} tag={value === choosing.value ? 'Selected' : undefined}
        onPress={() => void choose(choosing, value)} />)}
    </Dialog> : null}
    {menu ? <Dialog title={appLabel(appId)} onClose={() => setMenu(false)}>
      <Row title="Show log" onPress={!busy ? () => void readLog() : undefined} />
      <Row title="Uninstall application" onPress={() => { setMenu(false); setConfirmRemove(true); }} />
    </Dialog> : null}
    {confirmRemove ? <Dialog title="Uninstall application?" onClose={() => setConfirmRemove(false)}>
      <Body>{`${appLabel(appId)} and its data will be deleted after confirmation on the car.`}</Body>
      <Button label="Request uninstall" kind="danger" onPress={() => void after(uninstall(car, appId))} />
    </Dialog> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
