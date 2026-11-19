/** The installer's log, and sharing of it and of logs fetched from the car. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logName, logText, type InstallerState } from './state';
import { t } from '../i18n';
import { Button, Panel } from '../ui/kit';
import { LogText } from '../ui/LogText';

async function share(uri: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/plain' });
}

async function shareLog(text: string): Promise<void> {
  const file = new File(Paths.cache, `installer-${Math.floor(Date.now() / 1000)}.log`);
  file.write(text);
  await share(file.uri);
}

export function LogPanel({ state }: { state: InstallerState }) {
  const [details, setDetails] = useState(false);
  return (
    <Panel>
      <LogText text={logText(state, details)} />
      <View style={styles.buttons}>
        <Button label={t(details ? 'log.fewer' : 'log.more')} kind="plain" onPress={() => setDetails(!details)} />
        <Button label={t('common.share')} kind="plain" onPress={() => void shareLog(logText(state, true))} />
      </View>
    </Panel>
  );
}

/** A share button for the newest log of each kind fetched from the car. */
export function FetchedLogs({ state }: { state: InstallerState }) {
  const newest = (['collection', 'system', 'debug'] as const)
    .map(kind => state.fetched.find(log => log.kind === kind))
    .filter(log => log !== undefined);
  if (!newest.length) return null;
  return (
    <View style={styles.buttons}>
      {newest.map(log => (
        <Button key={log.uri} kind="plain" onPress={() => void share(log.uri)}
          label={t('log.shareKind', { what: logName(log.kind) ?? '' })} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
