// SPDX-License-Identifier: MPL-2.0
/** Asked once: whether the app may send diagnostics (store/diagnostics.ts). After "What's new",
 * never over it; either answer is kept, and More › Settings changes it. */
import { chooseDiagnostics } from '../store/diagnostics';
import { usePreferences } from '../store/preferences';
import { Dialog } from '../ui/Dialog';
import { Body, Button } from '../ui/kit';
import { shouldShowWhatsNew } from '../whatsNew';
import { t } from '../i18n';

export function DiagnosticsSheet({ ready, usedBefore }: { ready: boolean; usedBefore: boolean }) {
  const { diagnostics, whatsNew } = usePreferences();
  if (!ready || diagnostics !== undefined || whatsNew === undefined || shouldShowWhatsNew(whatsNew, usedBefore)) return null;
  return (
    <Dialog title={t('diag.question')} onClose={() => void chooseDiagnostics(false)} closeLabel={t('diag.no')}>
      <Body>{t('diag.body')}</Body>
      <Button label={t('diag.yes')} onPress={() => void chooseDiagnostics(true)} />
    </Dialog>
  );
}
