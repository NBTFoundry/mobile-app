import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'NBT Manager',
  slug: 'nbt-manager',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['android'],
  android: {
    package: 'net.cornera.nbtmgr',
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
  plugins: [
    ['expo-camera', { cameraPermission: 'Scan the Wi-Fi code on your car.', recordAudioAndroid: false }],
    'expo-secure-store',
    // Target 36, not 37: Android 17 puts local addresses behind ACCESS_LOCAL_NETWORK.
    // Expo SDK 58's modules require compiling against 37, which changes no runtime behaviour.
    ['expo-build-properties', { android: { minSdkVersion: 29, compileSdkVersion: 37,
      targetSdkVersion: 36, buildArchs: ['arm64-v8a'] } }],
    './plugins/withCarApp',
  ],
};
export default config;
