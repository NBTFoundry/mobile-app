// SPDX-License-Identifier: MPL-2.0
/** Every application once, with its next step: updates first, then what the car runs, then
 * what can be added to it (store/appList.ts). The catalog is read online when the user asks:
 * the button, or a pull on the list. */
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AppState } from '../App';
import { useConnection } from '../car/connection';
import { describeError } from '../car/messages';
import { install, refreshApps } from '../car/operations';
import { appList, type AppItem } from '../store/appList';
import { checkAppUpdate } from '../store/appUpdate';
import { fetchCatalog } from '../store/catalog';
import { isDownloading, startDownload, useDownloads, type DownloadState } from '../store/downloads';
import { useBetas } from '../store/preferences';
import { AppIcon } from '../ui/AppIcon';
import { Body, Button, Heading, Label, Panel, Pill, Progress, Row, Title, useColors, useStyles } from '../ui/kit';
import { LinkDot, Skeleton, type LinkState } from '../ui/motion';
import { formatWhen, t, tn } from '../i18n';
import { ActivityDialog } from './ActivityDialog';

function detailOf(item: AppItem, download: DownloadState | undefined): string | undefined {
  if (isDownloading(download)) return t('store.downloading', { percent: Math.floor(download.fraction * 100) });
  if (download) return download.problem;
  if (item.onCar && item.target && item.installed) return `${item.installed.version} → ${item.target}`;
  if (item.onCar) return item.installed?.version ?? item.target;
  if (item.held && !item.online) return t('apps.downloaded', { version: item.held.info.version });
  const beta = item.online?.prerelease ? `${t('store.beta')} · ` : '';
  return `${beta}${item.entry?.summary ?? item.held?.info.version ?? ''}` || undefined;
}

export function AppsScreen({ state }: { state: AppState }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { car, library, catalog } = state;
  const betas = useBetas();
  const downloads = useDownloads();
  const connection = useConnection();
  const [reading, setReading] = useState(false);
  const [readingCar, setReadingCar] = useState(false);
  const [problem, setProblem] = useState<string>();
  /** An install or update followed in a modal. */
  const [following, setFollowing] = useState<number>();
  const ours = !!car && (!!car.desk || connection.carId === car.id);
  const link: LinkState = !car ? 'off' : car.desk || (ours && connection.state === 'connected') ? 'on'
    : ours && connection.state === 'joining' ? 'busy' : 'off';

  const readCar = async () => {
    if (!car) return;
    setReadingCar(true);
    const updated = await refreshApps(car);
    if (updated) state.updateCar(updated);
    setReadingCar(false);
  };
  /** Online: the catalog, and with it an update of this app. The car too when it is connected. */
  const check = async () => {
    setReading(true);
    setProblem(undefined);
    void checkAppUpdate(true);
    if (link === 'on') void readCar();
    try {
      state.setCatalog(await fetchCatalog());
    } catch (error) {
      setProblem(describeError(error));
    }
    setReading(false);
  };
  const act = (item: AppItem) => {
    if (item.step === 'get' && item.entry && item.online) startDownload(item.entry, item.online);
    else if (car && item.held && item.step !== 'none') {
      void install(car, item.held, setFollowing).then(() => state.reloadCars());
    }
  };

  const list = appList(car, library, catalog, betas);
  const row = (item: AppItem) => {
    const download = downloads[item.id];
    const busy = isDownloading(download);
    return (
      <Row key={item.id} icon={<AppIcon id={item.id} name={item.name} />} title={item.name} detail={detailOf(item, download)}
        detailLines={1} onPress={() => state.go({ app: item.id })}
        right={busy || item.step === 'none' ? undefined : <Pill filled={item.step !== 'get'} onPress={() => act(item)}
          label={t(item.step === 'get' ? 'apps.get' : item.step === 'update' ? 'app.tagUpdate' : 'app.tagInstall')} />}>
        {busy ? <Progress value={download.fraction} /> : null}
      </Row>
    );
  };
  return (
    <ScrollView contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={reading} onRefresh={() => void check()} colors={[colors.accent]}
        progressBackgroundColor={colors.panel} tintColor={colors.accent} />}>
      <View style={styles.header}>
        <View style={styles.headerText}>{car ? <Label>{car.name}</Label> : null}<Title>{t('apps.title')}</Title></View>
        {car ? <Pressable accessibilityRole="button" onPress={() => state.go({ tab: 'car' })} hitSlop={12} style={styles.chip}>
          <LinkDot state={link} />
          <Text style={styles.chipText}>{t(link === 'on' ? 'car.connected' : link === 'busy' ? 'common.connecting' : 'car.notConnected')}</Text>
        </Pressable> : null}
      </View>
      {!car ? <Panel>
        <Heading>{t('apps.pairTitle')}</Heading>
        <Body muted>{t('apps.pairBody')}</Body>
        <Button label={t('common.pairCar')} onPress={() => state.go({ tab: 'car', page: 'pairing' })} />
      </Panel> : null}
      {list.updates.length ? <View>
        <Label>{tn('apps.updates', list.updates.length)}</Label>
        {list.updates.map(row)}
      </View> : null}
      {car ? <View>
        <Label>{t('apps.onCar')}</Label>
        {readingCar ? <Skeleton rows={2} />
          : car.apps === undefined ? <Row title={t('car.readApps')} detail={t('car.readToSee')} onPress={() => void readCar()} />
            : list.onCar.length ? list.onCar.map(row)
              : list.updates.some(item => item.id !== 'manager') ? null : <Body muted>{t('car.noApps')}</Body>}
      </View> : null}
      {list.more.length ? <View>
        <Label>{t('apps.more')}</Label>
        {list.more.map(row)}
      </View> : null}
      {catalog ? <View style={styles.footer}>
        <Body muted>{t('apps.checked', { time: formatWhen(catalog.fetchedAt) })}</Body>
        <Button label={t('apps.check')} kind="plain" disabled={reading} onPress={() => void check()} />
      </View> : reading ? <Skeleton /> : <Panel>
        <Heading>{t('apps.findTitle')}</Heading>
        <Body muted>{t('apps.findBody')}</Body>
        <Button label={t('apps.find')} onPress={() => void check()} />
      </Panel>}
      {problem ? <Body>{problem}</Body> : null}
      {following !== undefined ? <ActivityDialog id={following} onClose={() => setFollowing(undefined)} /> : null}
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 },
  headerText: { flex: 1, minWidth: 160 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 36 },
  chipText: { color: colors.muted, fontSize: 13 },
  footer: { alignItems: 'flex-start', gap: 4 },
});
