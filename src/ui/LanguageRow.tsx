// SPDX-License-Identifier: MPL-2.0
/** The Language row and its choices: Automatic (the phone's), then each language by its own name. */
import { useState } from 'react';
import { currentChoice, LANGUAGE_NAMES, LANGUAGES, systemLanguage, t, useLanguage, type Choice } from '../i18n';
import { chooseLanguage } from '../store/preferences';
import { Body, Row } from './kit';
import { Dialog } from './Dialog';

const name = (choice: Choice) =>
  (choice === 'auto' ? t('language.auto', { name: LANGUAGE_NAMES[systemLanguage()] }) : LANGUAGE_NAMES[choice]);

export function LanguageRow() {
  useLanguage();
  const [open, setOpen] = useState(false);
  const chosen = currentChoice();
  return <>
    <Row title={t('language.title')} detail={name(chosen)} onPress={() => setOpen(true)} />
    {open ? <Dialog title={t('language.title')} onClose={() => setOpen(false)}>
      <Body muted>{t('language.hint')}</Body>
      {(['auto', ...LANGUAGES] as Choice[]).map(choice => (
        <Row key={choice} title={name(choice)} tag={choice === chosen ? t('common.selected') : undefined}
          onPress={() => { setOpen(false); void chooseLanguage(choice); }} />
      ))}
    </Dialog> : null}
  </>;
}
