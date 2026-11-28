// SPDX-License-Identifier: MPL-2.0
/** Actions in progress and their results. Results come from the car's state, never from the phone. */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { stopFollowing } from '../car/operations';
import { useActivities, type ActivityPhase } from '../store/activity';
import { Body, Button, Panel, Progress, Title, useColors, useStyles } from '../ui/kit';
import { Lottie } from '../ui/Lottie';
import { formatTime, t } from '../i18n';
import { pictureOf } from './ActivityDialog';

const phases = (colors: ReturnType<typeof useColors>): Record<ActivityPhase, { label: string; color: string }> => ({
  running: { label: t('activity.running'), color: colors.accent },
  done: { label: t('activity.done'), color: colors.ok },
  refused: { label: t('activity.refused'), color: colors.warn },
  failed: { label: t('activity.failed'), color: colors.bad },
});

export function ActivityScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const PHASE = phases(colors);
  const activities = useActivities();
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Title>{t('activity.title')}</Title>
      {activities.length === 0 ? <Body muted>{t('activity.empty')}</Body> : null}
      {activities.map(a => (
        <Panel key={a.id}>
          <View style={styles.head}>
            {/* What runs moves; what is over shows how it ended, still. */}
            <Lottie name={pictureOf(a)} size={36} still={a.phase !== 'running'}
              mark={a.phase === 'refused' ? colors.warn : undefined} />
            <Text style={styles.title}>{a.title}</Text>
            <Text style={[styles.phase, { color: PHASE[a.phase].color }]}>{PHASE[a.phase].label}</Text>
          </View>
          <Body muted>{`${a.carName} · ${formatTime(a.startedAt)}`}</Body>
          {a.digits && a.phase === 'running' ? (
            <Text style={styles.digits}>{`${a.digits.slice(0, 3)} ${a.digits.slice(3)}`}</Text>
          ) : null}
          <Body>{a.detail}</Body>
          {a.phase === 'running' && a.progress !== undefined && a.progress < 1 ? <Progress value={a.progress} /> : null}
          {a.phase === 'running' ? (
            <Button label={t('activity.stopFollowing')} kind="plain" onPress={() => stopFollowing(a.id)} />
          ) : null}
        </Panel>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 },
  phase: { fontSize: 14, fontWeight: '700' },
  digits: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: 5, textAlign: 'center',
    fontVariant: ['tabular-nums'] },
});
