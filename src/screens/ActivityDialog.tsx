// SPDX-License-Identifier: MPL-2.0
/** One action followed in a modal: a picture of what is happening (joining the car, sending,
 * waiting for the driver, the car working), its progress, then how it ended. */
import { StyleSheet, View } from 'react-native';
import { stopFollowing } from '../car/operations';
import { useActivities, type Activity } from '../store/activity';
import { Body, Progress, useColors } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { Lottie, type LottieName } from '../ui/Lottie';
import { t } from '../i18n';

/** The animation that says where an action is. */
export function pictureOf(activity: Pick<Activity, 'phase' | 'stage'>): LottieName {
  if (activity.phase === 'done') return 'done';
  if (activity.phase !== 'running') return 'failed';
  return activity.stage ?? 'connect';
}

export function ActivityDialog({ id, note, onClose }: {
  id: number;
  /** Shown under a finished action's result (what is left to do on the car). */
  note?: string;
  onClose: () => void;
}) {
  const colors = useColors();
  const activity = useActivities().find(a => a.id === id);
  if (!activity) return null;
  const running = activity.phase === 'running';
  const picture = pictureOf(activity);
  // While it runs, the button stops following it here; the car keeps its own state.
  const close = () => {
    if (running) stopFollowing(id);
    onClose();
  };
  return <Dialog title={activity.title} closeLabel={running ? t('activity.stopFollowing') : t('common.close')}
    onClose={close}>
    <View style={styles.picture}>
      {/* A new key for each picture: it starts from its first frame. */}
      <Lottie key={picture} name={picture} size={112} mark={activity.phase === 'refused' ? colors.warn : undefined} />
    </View>
    <Body>{activity.detail}</Body>
    {running && activity.progress !== undefined && activity.progress < 1 ? <>
      <Progress value={activity.progress} />
      <Body muted>{`${Math.floor(activity.progress * 100)}%`}</Body>
    </> : null}
    {!running && activity.phase === 'done' && note ? <Body muted>{note}</Body> : null}
  </Dialog>;
}

const styles = StyleSheet.create({
  picture: { alignItems: 'center' },
});
