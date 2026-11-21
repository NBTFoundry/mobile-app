// SPDX-License-Identifier: MPL-2.0
/** An application's packages, settings and maintenance on a specific car. */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { clearLog, fetchAppLog, type CarLog } from '../car/logs';
import { applyAutostart, applySetting, install, loadSettings, uninstall } from '../car/operations';
import { compareU64 } from '../protocol/bytes';
import type { Autostart, Setting } from '../protocol/replies';
import type { CarRecord } from '../store/cars';
import { appLabel, type LibraryEntry } from '../store/library';
import { Body, Busy, Button, Label, Panel, Row, Title } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { ActivityDialog } from './ActivityDialog';
import { FilesPanel } from './FilesPanel';
import { LogView } from './LogView';
import { t, tn } from '../i18n';

export function AppScreen({ state, car, appId }: { state: AppState; car: CarRecord; appId: string }) {
  const [settings, setSettings] = useState<Setting[]>();
  const [autostart, setAutostart] = useState<Autostart | null>(null);
  const [choosing, setChoosing] = useState<Setting>();
  const [menu, setMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [log, setLog] = useState<CarLog>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [versions, setVersions] = useState(false);
  /** An install or update followed in a modal. */
  const [following, setFollowing] = useState<number>();
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
  const update = async (entry: LibraryEntry) => {
    await install(car, entry, setFollowing);
    await state.reloadCars();
  };
  const readSettings = async () => {
    setBusy(t('app.readingSettings')); setProblem(undefined);
    const result = await loadSettings(car, appId);
    setSettings(result?.settings);
    setAutostart(result?.autostart ?? null);
    if (!result) setProblem(t('app.readSettingsFailed'));
    setBusy(undefined);
  };
  const readLog = async () => {
    setMenu(false); setBusy(t('common.gettingLog')); setProblem(undefined);
    const result = await fetchAppLog(car, appId);
    setLog('log' in result ? result.log : undefined);
    setProblem('problem' in result ? result.problem : undefined);
    setBusy(undefined);
  };
  const emptyLog = async () => {
    setBusy(t('app.clearingLog'));
    if (log && await clearLog(car, appId)) setLog({ ...log, size: 0, tail: '' });
    else setProblem(t('app.clearLogFailed'));
    setBusy(undefined);
  };
  const switchAutostart = async (on: boolean) => {
    setBusy(t('app.saving')); setProblem(undefined);
    if (await applyAutostart(car, appId, on)) setAutostart(a => a && { ...a, on, paused: on && a.paused });
    else setProblem(t('app.saveFailed'));
    setBusy(undefined);
  };
  const choose = async (setting: Setting, value: string) => {
    setChoosing(undefined); setBusy(t('app.saving')); setProblem(undefined);
    if (await applySetting(car, appId, setting, value)) {
      setSettings(list => list?.map(s => s.key === setting.key ? { ...s, value } : s));
    } else setProblem(t('app.saveFailed'));
    setBusy(undefined);
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 200 }}><Label>{car.name}</Label><Title>{appLabel(appId)}</Title></View>
      {installed && !manager ? <Button label={t('app.more')} kind="plain" onPress={() => setMenu(true)} /> : null}
    </View>
    <Panel>
      <Body muted>{installed ? t('app.installedVersion', { version: installed.version }) : t(manager ? 'app.managerUpdate' : 'app.ready')}</Body>
      {canInstall ? <>
        <Body>{t('app.available', { version: latest.info.version })}</Body>
        <Button label={t(manager || installed ? 'app.updateTo' : 'app.installVersion', { version: latest.info.version })}
          onPress={() => void update(latest)} />
        <Body muted>{t('app.confirmOnCar')}</Body>
      </> : <>
        <Body muted>{t(latest && installed ? 'app.noNewer' : 'app.addPackage')}</Body>
        <Button label={t('app.openLibrary')} kind="plain" onPress={() => state.go({ tab: 'library' })} />
      </>}
    </Panel>
    {packages.length ? <>
      <Row title={t('app.versions')} expanded={versions} detail={tn('app.versionsCount', packages.length)}
        onPress={() => setVersions(!versions)} />
      {versions ? <View>{packages.map(entry => {
        const order = installed ? compareU64(entry.info.sequence, installed.sequence) : 1;
        const eligible = manager || order > 0;
        return <Row key={entry.sha256} title={entry.info.version}
          detail={t('app.sequence', { sequence: entry.info.sequence })}
          tag={t(eligible ? (installed || manager ? 'app.tagUpdate' : 'app.tagInstall') : order === 0 ? 'app.tagInstalled' : 'app.tagOlder')}
          onPress={eligible ? () => void update(entry) : undefined} />;
      })}</View> : null}
    </> : null}
    {installed && !manager ? <>
      <Label>{t('app.settings')}</Label>
      {settings === undefined ? <Row title={t('app.readSettings')} detail={t('app.readSettingsDetail')}
        onPress={!busy ? () => void readSettings() : undefined} />
        : settings.length === 0 ? <Body muted>{t('app.noSettings')}</Body>
          : <View>{settings.map(setting => <Row key={setting.key} title={setting.label} detail={setting.value}
            onPress={!busy ? () => setChoosing(setting) : undefined} />)}</View>}
      {settings !== undefined && autostart ? <Row title={t('app.startWithCar')}
        detail={t(autostart.paused ? 'app.autostartPaused' : autostart.on ? 'app.autostartOn' : 'app.autostartOff')}
        onPress={!busy ? () => void switchAutostart(!autostart.on) : undefined} /> : null}
      <FilesPanel car={car} appId={appId} />
    </> : null}
    {busy ? <Busy text={busy} /> : null}
    {problem ? <><Body>{problem}</Body><Button label={t('common.viewActivity')} kind="plain" onPress={() => state.go({ tab: 'activity' })} /></> : null}
    {log ? <LogView log={log} onClose={() => setLog(undefined)} onClear={!busy ? () => void emptyLog() : undefined} /> : null}
    {choosing ? <Dialog title={choosing.label} onClose={() => setChoosing(undefined)}>
      {choosing.choices.map(value => <Row key={value} title={value} tag={value === choosing.value ? t('common.selected') : undefined}
        onPress={() => void choose(choosing, value)} />)}
    </Dialog> : null}
    {menu ? <Dialog title={appLabel(appId)} onClose={() => setMenu(false)}>
      <Row title={t('app.showLog')} onPress={!busy ? () => void readLog() : undefined} />
      <Row title={t('app.uninstall')} onPress={() => { setMenu(false); setConfirmRemove(true); }} />
    </Dialog> : null}
    {following !== undefined ? <ActivityDialog id={following} onClose={() => setFollowing(undefined)}
      note={manager ? t('app.managerFinish') : undefined} /> : null}
    {confirmRemove ? <Dialog title={t('app.uninstallQuestion')} onClose={() => setConfirmRemove(false)}>
      <Body>{t('app.uninstallBody', { app: appLabel(appId) })}</Body>
      <Button label={t('app.requestUninstall')} kind="danger" onPress={() => void after(uninstall(car, appId))} />
    </Dialog> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
