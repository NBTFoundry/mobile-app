// SPDX-License-Identifier: MPL-2.0
/** Diagnostics (Expo Observe): how fast the app starts and its crashes, sent to Expo with a
 * random id of this installation, only once the user has agreed (More › Settings; asked once).
 * The build starts with consent not granted (app.config.ts); Observe keeps the answer itself,
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
