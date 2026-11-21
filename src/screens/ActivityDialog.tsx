// SPDX-License-Identifier: MPL-2.0
/** One action followed in a modal: what is happening, its progress, then its result. */
import { stopFollowing } from '../car/operations';
import { useActivities } from '../store/activity';
import { Body, Busy, Progress } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { t } from '../i18n';

export function ActivityDialog({ id, note, onClose }: {
  id: number;
  /** Shown under a finished action's result (what is left to do on the car). */
  note?: string;
  onClose: () => void;
}) {
  const activity = useActivities().find(a => a.id === id);
  if (!activity) return null;
  const running = activity.phase === 'running';
  // While it runs, the button stops following it here; the car keeps its own state.
  const close = () => {
    if (running) stopFollowing(id);
    onClose();
  };
  return <Dialog title={activity.title} closeLabel={running ? t('activity.stopFollowing') : t('common.close')}
    onClose={close}>
    {running ? <Busy text={activity.detail} /> : <Body>{activity.detail}</Body>}
    {running && activity.progress !== undefined && activity.progress < 1 ? <>
      <Progress value={activity.progress} />
      <Body muted>{`${Math.floor(activity.progress * 100)}%`}</Body>
    </> : null}
    {!running && activity.phase === 'done' && note ? <Body muted>{note}</Body> : null}
  </Dialog>;
}
