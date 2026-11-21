// SPDX-License-Identifier: MPL-2.0
/** Package files stored on this phone and shared by all cars. */
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { describeError } from '../car/messages';
import { addPackage, appLabel, removePackage } from '../store/library';
import { Body, Busy, Button, Heading, Label, Panel, Row, Title, formatSize } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { formatDate, t } from '../i18n';

export function LibraryScreen({ state }: { state: AppState }) {
  const [message, setMessage] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true); setMessage(undefined);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: '*/*' });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const { entries, outcome, other } = await addPackage(state.library, asset.uri, asset.name);
      setMessage(t(`library.${outcome}`, other && { app: appLabel(other.info.app), version: other.info.version }));
      state.setLibrary(entries);
    } catch (error) { setMessage(describeError(error)); }
    finally { setBusy(false); }
  };
  const remove = async (sha256: string) => {
    setBusy(true);
    try {
      state.setLibrary(await removePackage(state.library, sha256));
      setSelected(undefined);
    } catch (error) { setMessage(describeError(error)); }
    finally { setBusy(false); }
  };
  if (!state.libraryReady) return <View style={styles.page}><Title>{t('library.title')}</Title><Busy text={t('library.reading')} /></View>;
  const entry = state.library.find(item => item.sha256 === selected);
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <Title>{t('library.title')}</Title>
      {state.library.length ? <Button label={t('library.addFile')} kind="plain" disabled={busy} onPress={() => void add()} /> : null}
    </View>
    <Body muted>{t('library.intro')}</Body>
    {state.library.length ? <View>{state.library.map(item => (
      <Row key={item.sha256} title={appLabel(item.info.app)} detail={`${item.info.version} · ${formatSize(item.size)}`}
        onPress={() => setSelected(item.sha256)} />
    ))}</View> : <Panel>
      <Heading>{t('library.emptyHeading')}</Heading>
      <Body muted>{t('library.emptyBody')}</Body>
      <Button label={t('library.addAFile')} disabled={busy} onPress={() => void add()} />
    </Panel>}
    {busy ? <Busy text={t('library.updating')} /> : null}
    {message ? <Body>{message}</Body> : null}
    {entry ? <Dialog title={`${appLabel(entry.info.app)} ${entry.info.version}`} onClose={() => setSelected(undefined)}>
      <Body>{entry.fileName}</Body>
      <Body muted>{t('library.sizeAdded', { size: formatSize(entry.size), date: formatDate(entry.addedAt) })}</Body>
      <Label>{t('app.sequence', { sequence: entry.info.sequence })}</Label>
      <Body muted>{t('library.verifies')}</Body>
      <Body muted>{t('library.removeNote')}</Body>
      <Button label={t('library.remove')} kind="danger" disabled={busy} onPress={() => void remove(entry.sha256)} />
    </Dialog> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
