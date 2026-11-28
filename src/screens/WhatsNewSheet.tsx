// SPDX-License-Identifier: MPL-2.0
/** "What's new", once after an update that brings something (whatsNew.ts), and again from About. */
import { useEffect } from 'react';
import { markWhatsNewSeen, usePreferences } from '../store/preferences';
import { Dialog } from '../ui/Dialog';
import { Body } from '../ui/kit';
import { WHATS_NEW_ID, WHATS_NEW_ITEMS, shouldShowWhatsNew } from '../whatsNew';
import { t } from '../i18n';

/** `ready`: preferences, cars and the library are loaded; `usedBefore`: there are cars or packages. */
export function WhatsNewSheet({ ready, usedBefore }: { ready: boolean; usedBefore: boolean }) {
  const { whatsNew } = usePreferences();
  // A new install starts from this list without seeing it.
  useEffect(() => {
    if (ready && whatsNew === undefined && !usedBefore) void markWhatsNewSeen(WHATS_NEW_ID);
  }, [ready, usedBefore, whatsNew]);
  if (!ready || !shouldShowWhatsNew(whatsNew, usedBefore)) return null;
  return (
    <Dialog title={t('whatsNew.title')} onClose={() => void markWhatsNewSeen(WHATS_NEW_ID)} closeLabel={t('whatsNew.ok')}>
      {WHATS_NEW_ITEMS.map(key => <Body key={key}>{`• ${t(key)}`}</Body>)}
    </Dialog>
  );
}
