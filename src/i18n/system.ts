// SPDX-License-Identifier: MPL-2.0
/** The phone's language, from React Native (its first locale, as Android reports it). */
import { I18nManager } from 'react-native';

export function systemLocale(): string | undefined {
  try {
    const constants = I18nManager.getConstants() as { localeIdentifier?: string | null };
    return constants.localeIdentifier ?? undefined;
  } catch {
    return undefined;
  }
}
