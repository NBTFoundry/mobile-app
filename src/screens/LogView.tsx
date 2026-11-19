/** A log read from the car: its end, scrolled to the newest line, and Share for the whole file. */
import { StyleSheet, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import type { CarLog } from '../car/logs';
import { Body, Button, Label, Panel } from '../ui/kit';
import { LogText } from '../ui/LogText';
import { t } from '../i18n';

async function share(uri: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/plain' });
}

/** `onClear`: an application's log can be emptied on the car (the iDrive log cannot). */
export function LogView({ log, onClose, onClear }: { log: CarLog; onClose: () => void; onClear?: () => void }) {
  return (
    <Panel>
      <Label>{t('log.title', { name: log.name })}</Label>
      {log.size ? (
        <LogText text={log.tail.replace(/\n$/, '')} />
      ) : <Body muted>{log.empty}</Body>}
      <View style={styles.buttons}>
        {log.size ? <Button label={t('common.share')} kind="plain" onPress={() => void share(log.uri)} /> : null}
        {log.size && onClear ? <Button label={t('log.clear')} kind="plain" onPress={onClear} /> : null}
        <Button label={t('common.close')} kind="plain" onPress={onClose} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
