/** Package files stored on this phone and shared by all cars. */
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppState } from '../App';
import { describeError } from '../car/messages';
import { addPackage, appLabel, removePackage } from '../store/library';
import { Body, Busy, Button, Heading, Label, Panel, Row, Title, formatSize } from '../ui/kit';
import { Dialog } from '../ui/Dialog';

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
      const next = await addPackage(state.library, asset.uri, asset.name);
      setMessage(next === state.library ? 'Already in your library.' : 'Package added.');
      state.setLibrary(next);
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
  if (!state.libraryReady) return <View style={styles.page}><Title>Library</Title><Busy text="Reading library…" /></View>;
  const entry = state.library.find(item => item.sha256 === selected);
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <Title>Library</Title>
      {state.library.length ? <Button label="Add file" kind="plain" disabled={busy} onPress={() => void add()} /> : null}
    </View>
    <Body muted>Packages on this phone, ready for any of your cars.</Body>
    {state.library.length ? <View>{state.library.map(item => (
      <Row key={item.sha256} title={appLabel(item.info.app)} detail={`${item.info.version} · ${formatSize(item.size)}`}
        onPress={() => setSelected(item.sha256)} />
    ))}</View> : <Panel>
      <Heading>Your library starts here</Heading>
      <Body muted>Add an application package or an NBT Manager update.</Body>
      <Button label="Add a file" disabled={busy} onPress={() => void add()} />
    </Panel>}
    {busy ? <Busy text="Updating library…" /> : null}
    {message ? <Body>{message}</Body> : null}
    {entry ? <Dialog title={`${appLabel(entry.info.app)} ${entry.info.version}`} onClose={() => setSelected(undefined)}>
      <Body>{entry.fileName}</Body>
      <Body muted>{`${formatSize(entry.size)} · Added ${new Date(entry.addedAt).toLocaleDateString()}`}</Body>
      <Label>{`Sequence ${entry.info.sequence}`}</Label>
      <Body muted>The car verifies this package before installing it.</Body>
      <Body muted>Removing this file frees phone storage. Applications installed on your cars stay available.</Body>
      <Button label="Remove file" kind="danger" disabled={busy} onPress={() => void remove(entry.sha256)} />
    </Dialog> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
