/** Scan the car's Wi-Fi code, join, propose this phone; the driver confirms the code on the car. */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AppState } from '../App';
import { pairCar, stopFollowing } from '../car/operations';
import { parseWifiCode } from '../protocol/wifiCode';
import { useActivities } from '../store/activity';
import { Body, Busy, Button, Panel, Title, useColors, useStyles } from '../ui/kit';

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
      setProblem('That is not the car’s code.');
      return;
    }
    scanned.current = true;
    setProblem(undefined);
    void pairCar(wifi, undefined, setActivityId).then(car => state.reloadCars(car?.id));
  };

  if (activity) {
    return (
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Title>Pair this phone</Title>
        {activity.digits && activity.phase === 'running' ? (
          <Panel>
            <Body>Confirm on the car if it shows:</Body>
            <Text style={styles.digits} accessibilityLabel={`Code ${activity.digits.split('').join(' ')}`}>
              {`${activity.digits.slice(0, 3)} ${activity.digits.slice(3)}`}
            </Text>
          </Panel>
        ) : null}
        {activity.phase === 'running' ? <Busy text={activity.detail} /> : <Body>{activity.detail}</Body>}
        {activity.phase === 'running' && activity.digits
          ? <Button label="Stop waiting" kind="plain" onPress={() => stopFollowing(activity.id)} /> : null}
        {activity.phase === 'done'
          ? <Button label="Show apps" onPress={() => state.go({ tab: 'car' })} /> : null}
        {activity.phase !== 'running' && activity.phase !== 'done'
          ? <Button label="Scan again" onPress={() => {
            scanned.current = false;
            setActivityId(undefined);
          }} /> : null}

      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Title>Pair a car</Title>
      <Body muted>On the car: App Manager › Settings › Pair a phone. Then scan the code.</Body>
      {!permission?.granted ? (
        <Panel>
          <Body muted>Camera access lets you scan the car’s Wi-Fi code.</Body>
          {permission?.canAskAgain === false
            ? <Button label="Open app settings" onPress={() => void Linking.openSettings()} />
            : <Button label="Allow the camera" onPress={() => void requestPermission()} />}
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
