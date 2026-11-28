// SPDX-License-Identifier: MPL-2.0
import type { ExpoConfig } from 'expo/config';
import { runtimeVersion } from './plugins/runtimeVersion';

const PROJECT = 'c0c9d77a-d148-42f4-a01d-a84b3fee17c8';

const config: ExpoConfig = {
  name: 'NBT Manager',
  slug: 'manager',
  owner: 'nbtfoundry',
  version: '0.2.0',
  // Links from other apps: nbtmanager://pair?wifi=… (README, "Pairing from another app").
  scheme: 'nbtmanager',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['android'],
  icon: './assets/icon.png',
  android: {
    package: 'org.nbtfoundry.manager',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#1d5fa8',
    },
    versionCode: Number(process.env.NBT_VERSION_CODE || 41),
    permissions: ['INTERNET', 'ACCESS_NETWORK_STATE', 'CHANGE_NETWORK_STATE',
      'ACCESS_WIFI_STATE', 'CHANGE_WIFI_STATE', 'CAMERA'],
    blockedPermissions: ['android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE',
      // From the template and SecureStore; nothing here uses them (no authenticated SecureStore).
      'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE',
      'android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT'],
  },
  // The Expo project (expo.dev/accounts/nbtfoundry/projects/manager) that cloud builds use (eas.json).
  extra: { eas: { projectId: PROJECT } },
  // Updates between store builds (docs/updates.md): for the native side this commit builds, and
  // never checked on their own (the user asks, src/store/appUpdate.ts). Kit builds
  // (scripts/build-release.sh) turn them off: a test build runs the code it was built from.
  runtimeVersion: runtimeVersion(__dirname),
  updates: { url: `https://u.expo.dev/${PROJECT}`, enabled: process.env.NBT_UPDATES !== '0',
    checkAutomatically: 'NEVER', fallbackToCacheTimeout: 0 },
  plugins: [
    ['expo-splash-screen', {
      image: './assets/splash-light.png', imageWidth: 160, backgroundColor: '#f6f7fa',
      dark: { image: './assets/splash-dark.png', backgroundColor: '#111318' },
    }],
    ['expo-camera', { cameraPermission: 'Scan the Wi-Fi code on your car.', recordAudioAndroid: false }],
    'expo-secure-store',
    // Target 36, not 37: Android 17 puts local addresses behind ACCESS_LOCAL_NETWORK.
    // Expo SDK 58's modules require compiling against 37, which changes no runtime behaviour.
    ['expo-build-properties', { android: { minSdkVersion: 29, compileSdkVersion: 37,
      targetSdkVersion: 36, buildArchs: ['arm64-v8a'] } }],
    // Diagnostics (src/store/diagnostics.ts): nothing is collected until the user agrees.
    ['expo-observe', { consent: 'not-granted' }],
    './plugins/withCarApp',
  ],
};
export default config;
