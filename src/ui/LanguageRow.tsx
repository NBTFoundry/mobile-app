// SPDX-License-Identifier: MPL-2.0
/** The Language row and its choices: Automatic (the phone's), then each language by its own name. */
import { currentChoice, LANGUAGE_NAMES, LANGUAGES, systemLanguage, t, useLanguage, type Choice } from '../i18n';
import { chooseLanguage } from '../store/preferences';
import { ChoiceRow } from './ChoiceRow';
import { IconTile } from './kit';

const name = (choice: Choice) =>
  (choice === 'auto' ? t('language.auto', { name: LANGUAGE_NAMES[systemLanguage()] }) : LANGUAGE_NAMES[choice]);

export function LanguageRow() {
  useLanguage();
  return <ChoiceRow icon={<IconTile small name="globe" />} title={t('language.title')} hint={t('language.hint')}
    choices={['auto', ...LANGUAGES] as Choice[]} chosen={currentChoice()} name={name}
    onChoose={choice => void chooseLanguage(choice)} />;
}
