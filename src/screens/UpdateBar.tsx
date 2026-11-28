// SPDX-License-Identifier: MPL-2.0
/** An update of this app is downloaded: said over the tabs, with a button that starts it now.
 * Not while something runs with the car, which a restart would cut; Later hides it until the
 * app opens again, when the update starts anyway. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { runningCount, useActivities } from '../store/activity';
import { restartForUpdate, useAppUpdate } from '../store/appUpdate';
import { Button, useColors, useStyles } from '../ui/kit';

export function UpdateBar() {
  const styles = useStyles(makeStyles);
  const [later, setLater] = useState(false);
  const ready = useAppUpdate().phase === 'ready';
  const busy = runningCount(useActivities()) > 0;
  if (!ready || later || busy) return null;
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Text style={styles.title}>{t('update.bar')}</Text>
      <Text style={styles.detail}>{t('update.barDetail')}</Text>
      <View style={styles.buttons}>
        <Button label={t('common.later')} kind="plain" onPress={() => setLater(true)} />
        <Button label={t('update.barRestart')} onPress={() => void restartForUpdate()} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  bar: { gap: 2, marginHorizontal: 12, marginBottom: 8, paddingTop: 10, paddingBottom: 6, paddingHorizontal: 14,
    backgroundColor: colors.panel, borderRadius: colors.card, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glow },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 13 },
});
