/** Scan the car's Wi-Fi code, join, propose this phone; the driver confirms the code on the car. */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AppState } from '../App';
import { pairCar, stopFollowing } from '../car/operations';
import { parseWifiCode } from '../protocol/wifiCode';
import { useActivities } from '../store/activity';
import { Body, Busy, Button, Panel, Title, useColors, useStyles } from '../ui/kit';
import { t } from '../i18n';

export function PairScreen({ state }: { state: AppState }) {
  const styles = useStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [activityId, setActivityId] = useState<number>();
  const [problem, setProblem] = useState<string>();
  const scanned = useRef(false);
  const activities = useActivities();
  const activity = activities.find(a => a.id === activityId);

  const onCode = (data: string) => {
    if (scanned.current) return;
    let wifi;
    try {
      wifi = parseWifiCode(data);
    } catch {
      setProblem(t('pair.notCode'));
      return;
    }
    scanned.current = true;
    setProblem(undefined);
    void pairCar(wifi, undefined, setActivityId).then(car => state.reloadCars(car?.id));
  };

  if (activity) {
    return (
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Title>{t('pair.title')}</Title>
        {activity.digits && activity.phase === 'running' ? (
          <Panel>
            <Body>{t('pair.confirmIf')}</Body>
            <Text style={styles.digits} accessibilityLabel={t('pair.code', { digits: activity.digits.split('').join(' ') })}>
              {`${activity.digits.slice(0, 3)} ${activity.digits.slice(3)}`}
            </Text>
          </Panel>
        ) : null}
        {activity.phase === 'running' ? <Busy text={activity.detail} /> : <Body>{activity.detail}</Body>}
        {activity.phase === 'running' && activity.digits
          ? <Button label={t('pair.stopWaiting')} kind="plain" onPress={() => stopFollowing(activity.id)} /> : null}
        {activity.phase === 'done'
          ? <Button label={t('pair.showApps')} onPress={() => state.go({ tab: 'car' })} /> : null}
        {activity.phase !== 'running' && activity.phase !== 'done'
          ? <Button label={t('pair.scanAgain')} onPress={() => {
            scanned.current = false;
            setActivityId(undefined);
          }} /> : null}

      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Title>{t('common.pairCar')}</Title>
      <Body muted>{t('pair.howTo')}</Body>
      {!permission?.granted ? (
        <Panel>
          <Body muted>{t('pair.cameraWhy')}</Body>
          {permission?.canAskAgain === false
            ? <Button label={t('pair.openSettings')} onPress={() => void Linking.openSettings()} />
            : <Button label={t('pair.allowCamera')} onPress={() => void requestPermission()} />}
        </Panel>
      ) : (
        <View style={styles.camera}>
          <CameraView style={StyleSheet.absoluteFill} facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            // `data` is ML Kit's display value, which for a Wi-Fi code is only the network
            // name; `raw` holds the encoded `WIFI:` text.
            onBarcodeScanned={result => onCode(result.raw ?? result.data)} />
        </View>
      )}
      {problem ? <Body>{problem}</Body> : null}

    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  camera: { flex: 1, minHeight: 280, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.panel },
  digits: { color: colors.text, fontSize: 48, fontWeight: '700', letterSpacing: 6, textAlign: 'center',
    fontVariant: ['tabular-nums'] },
});
