// SPDX-License-Identifier: MPL-2.0
/** Developer keys: lets a developer install their own applications. The phone only asks;
 * the driver checks the fingerprint and confirms on the car. */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { AppState } from '../App';
import { fetchKeys, forgetKey, trustKey, type KeyList } from '../car/keys';
import { describeError } from '../car/messages';
import { cleanKeyName, DeveloperKeyError, fingerprint, MAX_KEY_FILE, readDeveloperKey, type DeveloperKey } from '../protocol/developerKey';
import type { CarKey } from '../protocol/replies';
import { Body, Busy, Button, Heading, Label, Panel, Row, Title, useColors, useStyles } from '../ui/kit';
import type { Palette } from '../ui/theme';
import { Dialog } from '../ui/Dialog';
import { formatDate, t } from '../i18n';

type Picked = { key: DeveloperKey; name: string };

export function KeysScreen({ state }: { state: AppState }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { car } = state;
  const [list, setList] = useState<KeyList>();
  const [reading, setReading] = useState(false);
  const [picked, setPicked] = useState<Picked>();
  const [problem, setProblem] = useState<string>();
  const [removing, setRemoving] = useState<CarKey>();
  if (!car) return null;
  const read = async () => {
    setReading(true);
    setList(await fetchKeys(car));
    setReading(false);
  };
  const pick = async () => {
    setProblem(undefined);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: '*/*' })
      .catch(() => undefined);
    const asset = result && !result.canceled ? result.assets[0] : undefined;
    if (!asset) return;
    try {
      if ((asset.size ?? 0) > MAX_KEY_FILE) throw new Error('size');
      const key = readDeveloperKey(await new File(asset.uri).text());
      setPicked({ key, name: cleanKeyName(asset.name) });
    } catch (error) {
      setProblem(error instanceof DeveloperKeyError ? describeError(error) : t('keys.notPublicKey'));
    }
  };
  const send = async () => {
    if (!picked) return;
    const { key, name } = picked;
    setPicked(undefined);
    const status = await trustKey(car, cleanKeyName(name), key);
    if (status?.state === 'key-added') await read();
  };
  const remove = async (key: CarKey) => {
    setRemoving(undefined);
    const status = await forgetKey(car, key);
    if (status?.state === 'key-removed') await read();
  };
  const keys = list && 'keys' in list ? list.keys : undefined;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View><Label>{car.name}</Label><Title>{t('keys.title')}</Title></View>
      <Body muted>{t('keys.intro')}</Body>
      <Panel>
        <Button label={t(list ? 'keys.refresh' : 'keys.read')} disabled={reading} onPress={() => void read()} />
        {reading ? <Busy text={t('keys.reading')} /> : null}
        {list && 'unsupported' in list ? <Body>{t('keys.unsupported')}</Body> : null}
        {list && 'problem' in list ? <Body>{list.problem}</Body> : null}
        {keys && !keys.length ? <Body muted>{t('keys.none')}</Body> : null}
      </Panel>
      {keys?.length ? <View>{keys.map(key => <Row key={key.id} title={key.name}
        detail={t('keys.detail', { fingerprint: fingerprint(key.id), date: formatDate(key.added * 1000) })}
        onPress={() => setRemoving(key)} />)}</View> : null}
      {!list || 'keys' in list ? <Panel>
        <Heading>{t('keys.add')}</Heading>
        <Body muted>{t('keys.addHelp')}</Body>
        <Button label={t('keys.pick')} kind="plain" onPress={() => void pick()} />
        {problem ? <Body>{problem}</Body> : null}
      </Panel> : null}
      {picked ? <Dialog title={t('keys.confirmTitle')} onClose={() => setPicked(undefined)}>
        <Label>{t('keys.name')}</Label>
        <TextInput value={picked.name} onChangeText={name => setPicked({ ...picked, name })} maxLength={32}
          autoCorrect={false} style={styles.input} accessibilityLabel={t('keys.name')} placeholderTextColor={colors.muted} />
        <Label>{t('keys.fingerprint')}</Label>
        <Heading>{picked.key.fingerprint}</Heading>
        <Body muted>{t('keys.compare')}</Body>
        <Body muted>{t('keys.warning')}</Body>
        <Button label={t('keys.send')} onPress={() => void send()} />
      </Dialog> : null}
      {removing ? <Dialog title={t('keys.removeQuestion', { name: removing.name })} onClose={() => setRemoving(undefined)}>
        <Body muted>{t('keys.removeHelp')}</Body>
        <Button label={t('keys.remove')} onPress={() => void remove(removing)} />
      </Dialog> : null}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  input: { color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12,
    minHeight: 48, fontSize: 16 },
});
