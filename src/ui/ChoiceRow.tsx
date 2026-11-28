// SPDX-License-Identifier: MPL-2.0
/** A setting with a few choices: a row showing the one chosen, and the others in a dialog. */
import { useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Body, Row } from './kit';
import { t } from '../i18n';

export function ChoiceRow<T extends string>({ title, icon, choices, chosen, name, hint, onChoose }: {
  title: string; icon?: ReactNode; choices: readonly T[]; chosen: T; name: (choice: T) => string; hint?: string;
  onChoose: (choice: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Row compact icon={icon} title={title} value={name(chosen)} onPress={() => setOpen(true)} />
    {open ? <Dialog title={title} onClose={() => setOpen(false)}>
      {hint ? <Body muted>{hint}</Body> : null}
      {choices.map(choice => (
        <Row key={choice} title={name(choice)} tag={choice === chosen ? t('common.selected') : undefined}
          onPress={() => { setOpen(false); onChoose(choice); }} />
      ))}
    </Dialog> : null}
  </>;
}
