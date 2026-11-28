// SPDX-License-Identifier: MPL-2.0
/** The pages an application's page opens: its settings on the car, its files, its page on the
 * phone, what it is (description, permissions, versions) and what helps when it misbehaves. */
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { clearLog, fetchAppLog, type CarLog } from '../car/logs';
import { applyAutostart, applySetting, loadSettings, uninstall, type AppSettings } from '../car/operations';
import { compareU64 } from '../protocol/bytes';
import type { Setting } from '../protocol/replies';
import type { AppSection } from '../route';
import type { AppItem } from '../store/appList';
import type { CarRecord } from '../store/cars';
import { Body, Busy, Button, Label, Row, Title, Toggle, formatSize } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { Skeleton } from '../ui/motion';
import { PackageAbout } from '../ui/PackageAbout';
import { formatDate, t, type Key } from '../i18n';
import { CompanionPanel } from './CompanionPanel';
import { CrashesPanel } from './CrashesPanel';
import { FilesPanel } from './FilesPanel';
import { LogView } from './LogView';

const TITLES: Record<AppSection, Key> = {
  settings: 'app.settings', files: 'files.title', page: 'companion.title', about: 'app.about', help: 'app.help',
};

/** The application's settings, read when the page opens, and Start with the car. */
function Settings({ car, appId }: { car: CarRecord; appId: string }) {
  /** Not read yet; null: the read failed. */
  const [read, setRead] = useState<AppSettings | null>();
  const [round, setRound] = useState(0);
  const [choosing, setChoosing] = useState<Setting>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    let live = true;
    void loadSettings(car, appId).then(result => {
      if (live) setRead(result ?? null);
    });
    return () => {
      live = false;
    };
  }, [car, appId, round]);
  const save = async (run: Promise<boolean | undefined>, change: (old: AppSettings) => AppSettings) => {
    setBusy(true); setProblem(undefined);
    if (await run) setRead(old => old && change(old));
    else setProblem(t('app.saveFailed'));
    setBusy(false);
  };
  const choose = (setting: Setting, value: string) => {
    setChoosing(undefined);
    void save(applySetting(car, appId, setting, value), old => ({ ...old,
      settings: old.settings.map(s => (s.key === setting.key ? { ...s, value } : s)) }));
  };
  const autostart = (on: boolean) => void save(applyAutostart(car, appId, on), old => ({ ...old,
    autostart: old.autostart && { ...old.autostart, on, paused: on && old.autostart.paused } }));
  if (read === undefined) return <Skeleton />;
  if (read === null) return <>
    <Body>{t('app.readSettingsFailed')}</Body>
    <Button label={t('companion.retry')} kind="plain" onPress={() => { setRead(undefined); setRound(r => r + 1); }} />
  </>;
  return <>
    <View>
      {read.settings.map(setting => <Row key={setting.key} title={setting.label} value={setting.value}
        onPress={!busy ? () => setChoosing(setting) : undefined} />)}
      {read.autostart ? <Row title={t('app.startWithCar')}
        detail={read.autostart.paused ? t('app.autostartPaused') : undefined}
        onPress={!busy ? () => autostart(!read.autostart!.on) : undefined}
        right={<Toggle on={read.autostart.on} disabled={busy} label={t('app.startWithCar')} onChange={autostart} />} /> : null}
    </View>
    {!read.settings.length && !read.autostart ? <Body muted>{t('app.noSettings')}</Body> : null}
    {busy ? <Busy text={t('app.saving')} /> : null}
    {problem ? <Body>{problem}</Body> : null}
    {choosing ? <Dialog title={choosing.label} onClose={() => setChoosing(undefined)}>
      {choosing.choices.map(value => <Row key={value} title={value} tag={value === choosing.value ? t('common.selected') : undefined}
        onPress={() => choose(choosing, value)} />)}
    </Dialog> : null}
  </>;
}

/** What the application says about itself, the packages of it on this phone, where it comes from. */
function About({ state, item }: { state: AppState; item: AppItem }) {
  const packages = state.library.filter(e => e.info.app === item.id)
    .sort((a, b) => compareU64(b.info.sequence, a.info.sequence));
  const release = item.online ?? item.entry?.releases.find(r => r.version === (item.held?.info.version ?? item.installed?.version));
  const info = item.held?.info ?? release;
  const size = release?.files.reduce((sum, f) => sum + f.size, 0);
  return <>
    {info ? <PackageAbout info={info} summary={item.entry?.summary} notes={release?.notes} expanded /> : null}
    {item.installed || packages.length ? <View>
      <Label>{t('app.versions')}</Label>
      {item.installed ? <Row title={item.installed.version} detail={t('app.sequence', { sequence: item.installed.sequence })}
        tag={t('app.tagInstalled')} /> : null}
      {packages.map(entry => <Row key={entry.sha256} title={entry.info.version}
        detail={`${t('app.sequence', { sequence: entry.info.sequence })} · ${formatSize(entry.size)}`} tag={t('apps.onPhone')} />)}
    </View> : null}
    {item.entry ? <View style={styles.block}>
      <Body muted>{t('store.licence', { licence: item.entry.license })}</Body>
      {release && size ? <Body muted>{t('store.details', { size: formatSize(size),
        date: release.date ? formatDate(release.date) : '–' })}</Body> : null}
      <Button label={t('store.source')} kind="plain"
        onPress={() => void Linking.openURL(`https://github.com/${item.entry!.repo}`)} />
    </View> : null}
  </>;
}

/** The application's log, its crash reports, and removing it (confirmed on the car). */
function Help({ state, car, item }: { state: AppState; car: CarRecord; item: AppItem }) {
  const [log, setLog] = useState<CarLog>();
  const [crashes, setCrashes] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const readLog = async () => {
    setBusy(t('common.gettingLog')); setProblem(undefined);
    const result = await fetchAppLog(car, item.id);
    setLog('log' in result ? result.log : undefined);
    setProblem('problem' in result ? result.problem : undefined);
    setBusy(undefined);
  };
  const emptyLog = async () => {
    setBusy(t('app.clearingLog'));
    if (log && await clearLog(car, item.id)) setLog({ ...log, size: 0, tail: '' });
    else setProblem(t('app.clearLogFailed'));
    setBusy(undefined);
  };
  const remove = async () => {
    setConfirming(false);
    state.go({ page: 'activity' });
    await uninstall(car, item.id);
    await state.reloadCars();
  };
  return <>
    {log ? <LogView log={log} onClose={() => setLog(undefined)} onClear={!busy ? () => void emptyLog() : undefined} />
      : crashes ? <CrashesPanel car={car} app={item.id} onClose={() => setCrashes(false)} /> : <View>
        <Row title={t('app.showLog')} onPress={!busy ? () => void readLog() : undefined} />
        <Row title={t('crash.title')} onPress={() => setCrashes(true)} />
      </View>}
    {busy ? <Busy text={busy} /> : null}
    {problem ? <Body>{problem}</Body> : null}
    <Button label={t('app.uninstall')} kind="danger" onPress={() => setConfirming(true)} />
    {confirming ? <Dialog title={t('app.uninstallQuestion')} onClose={() => setConfirming(false)}>
      <Body>{t('app.uninstallBody', { app: item.name })}</Body>
      <Button label={t('app.requestUninstall')} kind="danger" onPress={() => void remove()} />
    </Dialog> : null}
  </>;
}

export function AppSectionScreen({ state, car, item, section }: {
  state: AppState; car?: CarRecord; item: AppItem; section: AppSection;
}) {
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View><Label>{item.name}</Label><Title>{t(TITLES[section])}</Title></View>
    {section === 'about' ? <About state={state} item={item} />
      : !car ? null
        : section === 'settings' ? <Settings car={car} appId={item.id} />
          : section === 'files' ? <FilesPanel car={car} appId={item.id} />
            : section === 'page' ? <CompanionPanel car={car} app={item.id} onClose={state.back} />
              : <Help state={state} car={car} item={item} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 20 },
  block: { alignItems: 'flex-start', gap: 4 },
});
