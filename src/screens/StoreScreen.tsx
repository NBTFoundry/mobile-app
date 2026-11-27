// SPDX-License-Identifier: MPL-2.0
/** Get apps: the online catalog's applications, downloaded into the library over the phone's
 * internet connection. Installing stays on the car's page, from the library. */
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { describeError } from '../car/messages';
import { compareU64 } from '../protocol/bytes';
import { CATALOG_FRESH_MS, fetchCatalog, releaseFor, type CatalogApp } from '../store/catalog';
import { downloadRelease, type DownloadProgress } from '../store/download';
import { appLabel, newestFor } from '../store/library';
import { chooseBetas, useBetas } from '../store/preferences';
import { Body, Busy, Button, Label, Panel, Progress, Row, Title, formatSize, useColors } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { PackageAbout } from '../ui/PackageAbout';
import { formatDate, formatDateTime, t } from '../i18n';

export function StoreScreen({ state, open }: { state: AppState; open?: string }) {
  const colors = useColors();
  const betas = useBetas();
  const { catalog } = state;
  // Older than CATALOG_FRESH_MS (or none yet): read again when the screen opens.
  const [reading, setReading] = useState(() => !catalog || Date.now() - catalog.fetchedAt > CATALOG_FRESH_MS);
  const [problem, setProblem] = useState<string>();
  const [selected, setSelected] = useState<string | undefined>(open);
  const [progress, setProgress] = useState<DownloadProgress>();
  const [message, setMessage] = useState<string>();

  const read = () => fetchCatalog()
    .then(fresh => { state.setCatalog(fresh); setProblem(undefined); }, error => setProblem(describeError(error)))
    .finally(() => setReading(false));
  const refresh = () => {
    setReading(true);
    setProblem(undefined);
    void read();
  };
  useEffect(() => {
    if (reading) void read();
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offered = (catalog?.apps ?? []).flatMap(app => {
    const release = releaseFor(app, betas);
    return release ? [{ app, release }] : [];
  });
  /** The library holds this release or a newer one. */
  const holds = (app: CatalogApp, sequence: string) => {
    const entry = newestFor(state.library, app.id);
    return entry ? compareU64(entry.info.sequence, sequence) >= 0 : undefined;
  };
  /** What the chosen car runs of an application: the manager's release or an installed app. */
  const onCar = (id: string) => (id === 'manager' ? state.car?.manager : state.car?.apps?.find(a => a.id === id)) ?? undefined;
  const tagFor = (app: CatalogApp, sequence: string) => {
    const running = onCar(app.id);
    if (running && compareU64(running.sequence, sequence) >= 0) return { text: t('common.upToDate'), color: colors.ok };
    const held = holds(app, sequence);
    if (held) return { text: t('store.inLibrary'), color: colors.ok };
    if (held === false) return { text: t('store.update'), color: colors.accent };
    return undefined;
  };

  const download = async (app: CatalogApp) => {
    const release = releaseFor(app, betas);
    if (!release) return;
    setMessage(undefined);
    setProgress({ done: 0, total: 1 });
    try {
      const result = await downloadRelease(state.library, app, release, setProgress);
      state.setLibrary(result.entries);
      const first = result.outcomes[0];
      setMessage(first && t(`library.${first.outcome}`, first.other
        && { app: appLabel(first.other.info.app), version: first.other.info.version }));
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setProgress(undefined);
    }
  };

  const chosen = offered.find(o => o.app.id === selected);
  const inLibrary = chosen && holds(chosen.app, chosen.release.sequence);
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <Title>{t('store.title')}</Title>
      <Button label={t('store.refresh')} kind="plain" disabled={reading} onPress={refresh} />
    </View>
    <Body muted>{t('store.intro')}</Body>
    {reading ? <Busy text={t('store.reading')} /> : null}
    {problem ? <Body>{problem}</Body> : null}
    {catalog ? <Body muted>{t('store.updated', { time: formatDateTime(catalog.fetchedAt) })}</Body> : null}
    {catalog && !offered.length ? <Body muted>{t('store.empty')}</Body> : null}
    <View>{offered.map(({ app, release }) => {
      const tag = tagFor(app, release.sequence)
        ?? (release.prerelease ? { text: t('store.beta'), color: colors.warn } : undefined);
      return <Row key={app.id} title={app.name} detail={`${release.version} · ${app.summary}`} detailLines={2}
        tag={tag?.text} tagColor={tag?.color} onPress={() => { setMessage(undefined); setSelected(app.id); }} />;
    })}</View>
    <Row title={t('store.betas')} detail={t(betas ? 'store.betasOn' : 'store.betasOff')}
      tag={betas ? t('common.selected') : undefined} onPress={() => void chooseBetas(!betas)} />
    {chosen ? <Dialog title={`${chosen.app.name} ${chosen.release.version}`}
      onClose={() => { if (!progress) setSelected(undefined); }}>
      {chosen.release.prerelease ? <Label>{t('store.beta')}</Label> : null}
      <PackageAbout info={chosen.release} summary={chosen.app.summary} notes={chosen.release.notes} />
      <Body muted>{t('store.licence', { licence: chosen.app.license })}</Body>
      <Body muted>{t('store.details', { size: formatSize(chosen.release.files.reduce((s, f) => s + f.size, 0)),
        date: chosen.release.date ? formatDate(chosen.release.date) : '–' })}</Body>
      {progress ? <Panel>
        <Body>{t('store.downloading', { percent: Math.floor((100 * progress.done) / Math.max(progress.total, 1)) })}</Body>
        <Progress value={progress.done / Math.max(progress.total, 1)} />
      </Panel> : inLibrary ? null : <Button label={t('store.download', {
        size: formatSize(chosen.release.files.reduce((s, f) => s + f.size, 0)) })}
        onPress={() => void download(chosen.app)} />}
      {message ? <Body>{message}</Body> : null}
      {inLibrary ? <Body muted>{t('library.verifies')}</Body> : null}
      {inLibrary && state.car ? <Button label={t('store.openOnCar', { car: state.car.name })}
        onPress={() => state.go({ tab: 'car', app: chosen.app.id })} /> : null}
      <Button label={t('store.source')} kind="plain" disabled={!!progress}
        onPress={() => void Linking.openURL(`https://github.com/${chosen.app.repo}`)} />
    </Dialog> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
