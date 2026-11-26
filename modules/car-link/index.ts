// SPDX-License-Identifier: MPL-2.0
import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

export type NativeLinkRequest = {
  host: string;
  method: string;
  route: string;
  headers: Record<string, string>;
  text?: string;
  fileUri?: string;
  size?: number;
  progressId?: string;
  /** A log route: a 200 reply is saved to `<cache>/car-logs/<saveAs>.log`. */
  saveAs?: string;
};

export type NativeSavedReply = { uri: string; size: number; tail: string };

type CarLinkNative = {
  /** Joins the car's Wi-Fi, or uses the one another app already joined (wireless phone
   * projection, on either of the car's networks). Resolves to the car's address on that
   * network's link, '' when Android does not tell. */
  join(ssid: string, passphrase: string): Promise<string>;
  release(): void;
  setDeskIp(ip: string | null): void;
  randomHex(bytes: number): string;
  /** Stops the upload of a request in flight (its progress id): it fails with `stopped`. */
  cancel(progressId: string): void;
  inspect(uri: string, headSize: number): Promise<{ size: number; sha256: string; head: string }>;
  request(request: NativeLinkRequest): Promise<{
    status: number; nonce: string | null; body: string; saved?: NativeSavedReply | null;
  }>;
  addListener(event: 'onProgress', listener: (e: { id: string; sent: number; total: number }) => void): EventSubscription;
  /** The car's network: given to this app, dropped by Android, or released by the app. */
  addListener(event: 'onNetwork', listener: (e: { state: 'connected' | 'lost' | 'released' }) => void): EventSubscription;
};

/** The car's Wi-Fi and its allow-listed requests. Errors carry a fixed code in `message`. */
export const CarLink = requireNativeModule<CarLinkNative>('CarLink');
