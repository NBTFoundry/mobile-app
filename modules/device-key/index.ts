import { requireNativeModule } from 'expo-modules-core';

export type Protection = 'strongbox' | 'tee' | 'software';

type DeviceKeyNative = {
  create(alias: string): Promise<{ publicKey: string; protection: Protection }>;
  publicKey(alias: string): Promise<string | null>;
  sign(alias: string, text: string): Promise<string>;
  remove(alias: string): Promise<void>;
};

/** P-256 keys in the Android Keystore, one per car; alias `car-<16 hex>`. */
export const DeviceKey = requireNativeModule<DeviceKeyNative>('DeviceKey');
