// SPDX-License-Identifier: MPL-2.0
/** The app's own preferences, in its storage: the language chosen (i18n). */
import { File, Paths } from 'expo-file-system';
import { isChoice, setChoice, type Choice } from '../i18n';

const file = () => new File(Paths.document, 'preferences.json');

/** Applies the saved language; Automatic when there is none or it cannot be read. */
export async function loadPreferences(): Promise<void> {
  try {
    const stored = file();
    if (!stored.exists) return;
    const raw = JSON.parse(await stored.text()) as { language?: unknown } | null;
    if (isChoice(raw?.language)) setChoice(raw.language);
  } catch {
    // Unreadable: Automatic.
  }
}

/** Shows `choice` at once and keeps it; false when it could not be kept. */
export async function chooseLanguage(choice: Choice): Promise<boolean> {
  setChoice(choice);
  try {
    await file().write(JSON.stringify({ language: choice }));
    return true;
  } catch {
    return false;
  }
}
