// SPDX-License-Identifier: MPL-2.0
/** An application on a car: its one next step on top (download, install, update), and the
 * rest behind a few rows, each a page of its own (AppSections.tsx). */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { install } from '../car/operations';
import { PERM } from '../protocol/permissions';
import type { AppSection } from '../route';
import { appItem, type AppItem } from '../store/appList';
import type { CarRecord } from '../store/cars';
import { listsNewest } from '../store/catalog';
import { isDownloading, startDownload, useDownloads } from '../store/downloads';
import { useBetas } from '../store/preferences';
import { aboutText } from '../ui/about';
import { AppIcon } from '../ui/AppIcon';
import { Body, Button, IconTile, Panel, ProgressButton, Row, Strong, Title, formatSize } from '../ui/kit';
import { Lottie } from '../ui/Lottie';
import { t } from '../i18n';
import { ActivityDialog } from './ActivityDialog';
import { AppSectionScreen } from './AppSections';

/** What the step brings, in two lines: what is new in that release, else what the application is. */
function leadOf(item: AppItem): string | undefined {
  const notes = item.entry?.releases.find(r => r.version === item.target)?.notes ?? [];
  const lines = notes.filter(line => !line.startsWith('### ')).map(line => line.replace(/^- /, ''));
  if (item.onCar && lines.length) return lines.slice(0, 2).join(' ');
  return aboutText(item.held?.info.text, item.entry?.summary).lead;
}

export function AppScreen({ state, car, appId, section }: {
  state: AppState; car?: CarRecord; appId: string; section?: AppSection;
}) {
  const betas = useBetas();
  const download = useDownloads()[appId];
  /** An install or update followed in a modal. */
  const [following, setFollowing] = useState<number>();
  const [opened] = useState(() => Date.now());
  const item = appItem(appId, car, state.library, state.catalog, betas);
  if (section) return <AppSectionScreen state={state} car={car} item={item} section={section} />;

  const manager = appId === 'manager';
  const installedApp = !!car && item.onCar && !manager;
  // A page on the phone, when a package of it on this phone declares one.
  const hasPage = installedApp && state.library.some(e => e.info.app === appId && (e.info.permissions ?? 0) & PERM.companion);
  const size = item.online?.files.reduce((sum, f) => sum + f.size, 0) ?? 0;
  const lead = leadOf(item);
  const send = () => {
    if (car && item.held) void install(car, item.held, setFollowing).then(() => state.reloadCars());
  };
  const open = (next: AppSection) => state.go({ app: appId, carId: car?.id, section: next });

  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.hero}>
      <AppIcon id={appId} name={item.name} size={60} />
      <View style={styles.heroText}>
        <Title>{item.name}</Title>
        <Body muted>{!car ? t('app.noCar') : !item.onCar ? t('app.notOnCar', { car: car.name })
          : item.installed ? t('app.onCar', { car: car.name, version: item.installed.version }) : car.name}</Body>
      </View>
    </View>
    {item.step === 'get' && item.entry && item.online ? <Panel>
      <View style={styles.lead}><Strong>{t('app.online', { version: item.online.version })}</Strong>
        {lead ? <Body lines={2} muted>{lead}</Body> : null}</View>
      {isDownloading(download)
        ? <ProgressButton value={download.fraction} label={t('store.downloading', { percent: Math.floor(download.fraction * 100) })} />
        : <Button label={t('store.download', { size: formatSize(size) })} onPress={() => startDownload(item.entry!, item.online!)} />}
      {download && !isDownloading(download) ? <Body>{download.problem}</Body> : null}
    </Panel> : item.step !== 'none' && item.held ? <Panel>
      <View style={styles.lead}><Strong>{t('app.isReady', { version: item.held.info.version })}</Strong>
        {lead ? <Body lines={2} muted>{lead}</Body> : null}</View>
      <Button label={t(item.step === 'update' ? 'app.updateTo' : 'app.installVersion', { version: item.held.info.version })}
        onPress={send} />
    </Panel> : !car ? <Panel>
      {lead ? <Body lines={3} muted>{lead}</Body> : null}
      <Body>{t('app.pairToInstall')}</Body>
      <Button label={t('common.pairCar')} onPress={() => state.go({ tab: 'car', page: 'pairing' })} />
    </Panel> : item.onCar ? (listsNewest(state.catalog, appId, opened) ? <View style={styles.done}>
      <Lottie name="done" size={32} /><Body muted>{t('common.upToDate')}</Body>
    </View> : null) : <Panel>
      <Body muted>{t('app.addPackage')}</Body>
      <Button label={t('app.openLibrary')} kind="plain" onPress={() => state.go({ tab: 'more', page: 'downloads' })} />
    </Panel>}
    <View>
      {installedApp ? <>
        <Row icon={<IconTile name="sliders" />} title={t('app.settings')} detail={t('app.settingsDetail')} onPress={() => open('settings')} />
        <Row icon={<IconTile name="folder" />} title={t('files.title')} detail={t('app.filesDetail')} onPress={() => open('files')} />
      </> : null}
      {hasPage ? <Row icon={<IconTile name="phone" />} title={t('companion.title')} detail={t('companion.openDetail')}
        onPress={() => open('page')} /> : null}
      {item.held || item.entry ? <Row icon={<IconTile name="info" />} title={t('app.about')} detail={t('app.aboutDetail')}
        onPress={() => open('about')} /> : null}
      {installedApp ? <Row icon={<IconTile name="help" />} title={t('app.help')} detail={t('app.helpDetail')}
        onPress={() => open('help')} /> : null}
    </View>
    {following !== undefined ? <ActivityDialog id={following} onClose={() => setFollowing(undefined)}
      note={manager ? t('app.managerFinish') : undefined} /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 20 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1, gap: 2 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lead: { gap: 4 },
});
