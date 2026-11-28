// SPDX-License-Identifier: MPL-2.0
/** About: every version in play (this app, the update it runs, the NBT Manager it carries for
 * a first install, the one on the selected car), the app's own update, and where it comes from. */
import { useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import type { AppState } from '../App';
import { CarLink } from '../../modules/car-link';
import { bundled } from '../installer/session';
import { checkAppUpdate, restartForUpdate, runningUpdate, updatesEnabled, useAppUpdate } from '../store/appUpdate';
import { showWhatsNewAgain } from '../store/preferences';
import { Mark } from '../ui/AppIcon';
import { Body, Busy, Button, Panel, Strong, useColors, useStyles } from '../ui/kit';
import { formatDate, t, tn } from '../i18n';

const SITE = 'https://nbtfoundry.github.io';
const SOURCE = 'https://github.com/NBTFoundry';

export function AboutCard({ state }: { state: AppState }) {
  const styles = useStyles(makeStyles);
  const update = useAppUpdate();
  const [running] = useState(runningUpdate);
  const [inside] = useState(bundled);
  const [installed] = useState(() => CarLink.appVersion());
  const { car } = state;
  const app = `${installed.name} (${installed.code})`;
  const code = !updatesEnabled() ? t('update.off') : running.embedded || !running.createdAt ? t('update.builtIn')
    : t('update.dated', { date: formatDate(running.createdAt) });
  const onCar = car?.manager ? tn('about.carValue', car.apps?.length ?? 0, { version: car.manager.version }) : undefined;
  const lines: [string, string][] = [[t('about.app'), app], [t('about.update'), code]];
  if (inside.available) lines.push([t('about.inside'), inside.version]);
  if (car && onCar) lines.push([t('about.onCar', { car: car.name }), onCar]);
  const share = () => void Share.share({ message: ['NBT Manager', ...lines.map(([label, value]) => `${label}: ${value}`),
    ...(running.id ? [running.id] : [])].join('\n') }).catch(() => undefined);
  return (
    <Panel>
      <View style={styles.head}>
        <Mark size={40} />
        <View style={styles.headText}><Strong>NBT Manager</Strong><Body muted>{t('about.tagline')}</Body></View>
      </View>
      <View style={styles.lines}>{lines.map(([label, value]) => (
        <View key={label} style={styles.line}>
          <Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text>
        </View>
      ))}</View>
      {update.phase === 'checking' ? <Busy text={t('update.checking')} /> : null}
      {update.phase === 'none' ? <Body muted>{t('update.none')}</Body> : null}
      {update.phase === 'failed' ? <Body>{t('update.failed')}</Body> : null}
      {update.phase === 'ready' ? <>
        <Body>{t('update.ready')}</Body>
        <Button label={t('update.restart')} onPress={() => void restartForUpdate()} />
      </> : null}
      <View style={styles.links}>
        {updatesEnabled() && update.phase !== 'ready' ? <Button label={t('update.check')} kind="plain"
          disabled={update.phase === 'checking'} onPress={() => void checkAppUpdate()} /> : null}
        <Button label={t('whatsNew.title')} kind="plain" onPress={() => void showWhatsNewAgain()} />
        <Button label={t('about.website')} kind="plain" onPress={() => void Linking.openURL(SITE)} />
        <Button label={t('store.source')} kind="plain" onPress={() => void Linking.openURL(SOURCE)} />
        <Button label={t('legal.licenses')} kind="plain" onPress={() => state.go({ page: 'licenses' })} />
        <Button label={t('about.share')} kind="plain" onPress={share} />
      </View>
    </Panel>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 2 },
  lines: { gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  links: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -12 },
});
