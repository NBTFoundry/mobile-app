// SPDX-License-Identifier: MPL-2.0
/** Car selection and management, separate from the applications dashboard. */
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { AppState } from '../App';
import { pairCar, connectCar, releaseCarNetwork } from '../car/operations';
import { removeKey } from '../car/nativeLink';
import { forgetCar, renameCar, type CarRecord } from '../store/cars';
import { Body, Button, Label, Panel, Row, Title, useColors, useStyles } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { LanguageRow } from '../ui/LanguageRow';
import { t, tn } from '../i18n';

function CarDetails({ car, state, onDone }: { car: CarRecord; state: AppState; onDone: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [name, setName] = useState(car.name);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const rename = async () => {
    const clean = name.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 40);
    if (!clean) return;
    setSaving(true);
    try { await renameCar(car.id, clean); await state.reloadCars(); onDone(); }
    finally { setSaving(false); }
  };
  const forget = async () => {
    setSaving(true);
    try {
      await forgetCar(car.id);
      await removeKey(car.keyAlias);
      releaseCarNetwork();
      await state.reloadCars();
      onDone();
    } finally { setSaving(false); }
  };
  return <Dialog title={t('cars.manage')} onClose={onDone}>
    <Label>{t('cars.name')}</Label>
    <TextInput value={name} onChangeText={setName} maxLength={40} style={styles.input}
      placeholderTextColor={colors.muted} accessibilityLabel={t('cars.nameLabel')} autoFocus />
    <Button label={t('cars.saveName')} disabled={saving || !name.trim()} onPress={() => void rename()} />
    {confirming ? <>
      <Body>{t('cars.forgetQuestion')}</Body>
      <Button label={t('cars.forget')} kind="danger" disabled={saving} onPress={() => void forget()} />
      <Button label={t('cars.keep')} kind="plain" onPress={() => setConfirming(false)} />
    </> : <Button label={t('cars.forgetThis')} kind="danger" onPress={() => setConfirming(true)} />}
  </Dialog>;
}

function DeskPairing({ state }: { state: AppState }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [ip, setIp] = useState('');
  const pair = async () => {
    state.go({ tab: 'activity' });
    const car = await pairCar({ ssid: 'Desk car', passphrase: '' }, ip);
    await state.reloadCars(car?.id);
  };
  return <Panel>
    <Body muted>{t('cars.deskHint')}</Body>
    <TextInput value={ip} onChangeText={setIp} placeholder="10.0.2.2:18080" keyboardType="url"
      autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.muted} style={styles.input}
      accessibilityLabel={t('cars.deskAddress')} />
    <Button label={t('cars.pairDesk')} disabled={!/^\d+\.\d+\.\d+\.\d+(:\d{4,5})?$/.test(ip)}
      onPress={() => void pair()} />
  </Panel>;
}

export function CarsScreen({ state }: { state: AppState }) {
  const [editing, setEditing] = useState<string>();
  const [development, setDevelopment] = useState(false);
  const styles = useStyles(makeStyles);
  const open = async (car: CarRecord) => {
    if (car.id !== state.car?.id) releaseCarNetwork();
    await state.reloadCars(car.id);
    state.go({ tab: 'car' });
    void connectCar(car);
  };
  const target = state.cars.find(car => car.id === editing);
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Title>{t('cars.title')}</Title>
    {state.cars.length ? <View>{state.cars.map(car => <View key={car.id}>
      <Row title={car.name} onPress={() => void open(car)}
        detail={car.apps ? tn('cars.apps', car.apps.length) : t('cars.notRead')}
        tag={car.id === state.car?.id ? t('common.selected') : undefined} />
      <View style={styles.manage}><Button label={t('cars.manage')} kind="plain" onPress={() => setEditing(car.id)} /></View>
    </View>)}</View> : <Body muted>{t('cars.none')}</Body>}
    <Button label={t('cars.pairAnother')} onPress={() => state.go({ tab: 'car', pairing: true })} />
    <Row title={t('common.installNbt')} onPress={() => state.go({ tab: 'car', installer: true })} />
    <LanguageRow />
    {__DEV__ ? <>
      <Row title={t('car.development')} expanded={development} detail={t(development ? 'cars.hideDesk' : 'cars.showDesk')} onPress={() => setDevelopment(!development)} />
      {development ? <DeskPairing state={state} /> : null}
    </> : null}
    {target ? <CarDetails key={target.id} car={target} state={state} onDone={() => setEditing(undefined)} /> : null}
  </ScrollView>;
}
const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { padding: 24, paddingBottom: 40, gap: 24 },
  input: { color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    paddingHorizontal: 16, minHeight: 48, fontSize: 16 },
  manage: { alignItems: 'flex-start' },
});
