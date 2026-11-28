// SPDX-License-Identifier: MPL-2.0
/** What the app is doing, over the tabs: the action that runs, with its picture and its progress
 * under it (a running line when there is none to measure), or the last one when it did not go
 * through, until Activity is opened. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { useActivities } from '../store/activity';
import { useColors, useStyles } from '../ui/kit';
import { Lottie } from '../ui/Lottie';
import { RunLine } from '../ui/motion';
import { pictureOf } from './ActivityDialog';

export function ActivityBar({ onOpen }: { onOpen: () => void }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const [seen, setSeen] = useState<number>();
  const latest = useActivities()[0];
  if (!latest || latest.phase === 'done' || (latest.phase !== 'running' && latest.id === seen)) return null;
  const running = latest.phase === 'running';
  return (
    <Pressable accessibilityRole="button" accessibilityHint={t('common.viewActivity')}
      onPress={() => { setSeen(latest.id); onOpen(); }} style={({ pressed }) => [styles.bar, pressed && { opacity: 0.75 }]}>
      <Lottie name={pictureOf(latest)} size={32} still={!running} mark={latest.phase === 'refused' ? colors.warn : undefined} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.title}>{latest.title}</Text>
        <Text numberOfLines={1} style={[styles.detail, !running && { color: latest.phase === 'failed' ? colors.bad : colors.warn }]}>
          {latest.digits && running ? `${latest.digits.slice(0, 3)} ${latest.digits.slice(3)} · ${latest.detail}` : latest.detail}
        </Text>
      </View>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>›</Text>
      {!running ? null : latest.progress !== undefined && latest.progress < 1
        ? <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(latest.progress * 100)}%` }]} /></View>
        : <RunLine />}
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 8, paddingVertical: 9,
    paddingHorizontal: 14, minHeight: 52, backgroundColor: colors.panel, borderRadius: colors.card, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  text: { flex: 1, gap: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.muted, fontSize: 22 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: colors.line },
  fill: { height: 2, backgroundColor: colors.glow },
});
