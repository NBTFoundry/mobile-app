/** Actions in progress and their results. Results come from the car's state, never from the phone. */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { stopFollowing } from '../car/operations';
import { useActivities, type ActivityPhase } from '../store/activity';
import { Body, Busy, Button, Panel, Progress, Title, useColors, useStyles } from '../ui/kit';

const phases = (colors: ReturnType<typeof useColors>): Record<ActivityPhase, { label: string; color: string }> => ({
  running: { label: 'In progress', color: colors.accent },
  done: { label: 'Done', color: colors.ok },
  refused: { label: 'Not done', color: colors.warn },
  failed: { label: 'Failed', color: colors.bad },
});

export function ActivityScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const PHASE = phases(colors);
  const activities = useActivities();
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Title>Activity</Title>
      {activities.length === 0 ? <Body muted>Your actions will appear here.</Body> : null}
      {activities.map(a => (
        <Panel key={a.id}>
          <View style={styles.head}>
            <Text style={styles.title}>{a.title}</Text>
            <Text style={[styles.phase, { color: PHASE[a.phase].color }]}>{PHASE[a.phase].label}</Text>
          </View>
          <Body muted>{`${a.carName} · ${new Date(a.startedAt).toLocaleTimeString()}`}</Body>
          {a.digits && a.phase === 'running' ? (
            <Text style={styles.digits}>{`${a.digits.slice(0, 3)} ${a.digits.slice(3)}`}</Text>
          ) : null}
          {a.phase === 'running' ? <Busy text={a.detail} /> : <Body>{a.detail}</Body>}
          {a.phase === 'running' && a.progress !== undefined && a.progress < 1 ? <Progress value={a.progress} /> : null}
          {a.phase === 'running' ? (
            <Button label="Stop following" kind="plain" onPress={() => stopFollowing(a.id)} />
          ) : null}
        </Panel>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 24 },
  head: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 },
  phase: { fontSize: 14, fontWeight: '700' },
  digits: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: 5, textAlign: 'center',
    fontVariant: ['tabular-nums'] },
});
