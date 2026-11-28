// SPDX-License-Identifier: MPL-2.0
/** Diagnostics (Expo Observe): how fast the app starts and its crashes, sent to Expo with a
 * random id of this installation. On from the first launch (app.config.ts); More › Settings ›
 * Share diagnostics turns them off, and "What's new" says so. Observe keeps the choice itself,
 * the preferences keep it for the switch. */
import { Observe } from 'expo-observe';
import { keepDiagnostics } from './preferences';

/** Starts or stops collection; stopping deletes what was not sent yet. */
export async function chooseDiagnostics(on: boolean): Promise<void> {
  await keepDiagnostics(on);
  try {
    await Observe.setConsent(on ? 'granted' : 'not-granted');
  } catch {
    // Observe stops collecting even when the phone could not keep the answer.
  }
}
