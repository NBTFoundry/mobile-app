// SPDX-License-Identifier: MPL-2.0
/** "What's new", once after an update that brings something (whatsNew.ts). */
import { useEffect, useState } from 'react';
import { markWhatsNewSeen, whatsNewSeen } from '../store/preferences';
import { Dialog } from '../ui/Dialog';
import { Body } from '../ui/kit';
import { WHATS_NEW_ID, WHATS_NEW_ITEMS, shouldShowWhatsNew } from '../whatsNew';
import { t } from '../i18n';

/** `ready`: preferences, cars and the library are loaded; `usedBefore`: there are cars or packages. */
export function WhatsNewSheet({ ready, usedBefore }: { ready: boolean; usedBefore: boolean }) {
  const [closed, setClosed] = useState(false);
  // A new install starts from this list without seeing it.
  useEffect(() => {
    if (ready && whatsNewSeen() === undefined && !usedBefore) void markWhatsNewSeen(WHATS_NEW_ID);
  }, [ready, usedBefore]);
  if (!ready || closed || !shouldShowWhatsNew(whatsNewSeen(), usedBefore)) return null;
  const close = () => {
    setClosed(true);
    void markWhatsNewSeen(WHATS_NEW_ID);
  };
  return (
    <Dialog title={t('whatsNew.title')} onClose={close} closeLabel={t('whatsNew.ok')}>
      {WHATS_NEW_ITEMS.map(key => <Body key={key}>{`• ${t(key)}`}</Body>)}
    </Dialog>
  );
}
