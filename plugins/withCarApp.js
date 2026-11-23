// SPDX-License-Identifier: MPL-2.0
// Plain JavaScript: the EAS CLI resolves config plugins from .js files only.
// @ts-check
const { withAndroidManifest, withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

// Release builds allow cleartext only to the car's two addresses. Debug builds load
// the dev client's bundle from Metro on the LAN, whose address varies, so they allow it
// everywhere. Car requests use native sockets and their own allow-list in both.
/** @param {boolean} debug */
const configXml = debug => `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="${debug}" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">172.16.222.1</domain>
    <domain includeSubdomains="false">172.16.224.1</domain>
  </domain-config>
</network-security-config>
`;

// Release builds are signed only with the dedicated keystore that scripts/build-release.sh
// names through the environment, or in a cloud build (EAS_BUILD) with the upload key EAS
// fills in; without either they stay unsigned, never debug-signed.
const RELEASE_SIGNING = `
        release {
            if (System.getenv('NBT_RELEASE_STORE_FILE')) {
                storeFile file(System.getenv('NBT_RELEASE_STORE_FILE'))
                storePassword System.getenv('NBT_RELEASE_STORE_PASSWORD')
                keyAlias System.getenv('NBT_RELEASE_KEY_ALIAS')
                keyPassword System.getenv('NBT_RELEASE_STORE_PASSWORD')
            }
        }`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withReleaseSigning = config => withAppBuildGradle(config, mod => {
  let gradle = mod.modResults.contents;
  if (!gradle.includes('NBT_RELEASE_STORE_FILE')) {
    const debugBlock = /(signingConfigs \{\n\s+debug \{[^}]*\})/;
    const releaseUse = /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/;
    if (!debugBlock.test(gradle) || !releaseUse.test(gradle)) throw new Error('Unexpected app/build.gradle signing layout');
    gradle = gradle.replace(debugBlock, `$1${RELEASE_SIGNING}`)
      .replace(releaseUse, "$1signingConfig((System.getenv('NBT_RELEASE_STORE_FILE') || System.getenv('EAS_BUILD')) ? signingConfigs.release : null)");
  }
  mod.modResults.contents = gradle;
  return mod;
});

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withCarApp = config => {
  config = withReleaseSigning(config);
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) throw new Error('Missing Android application');
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = 'false';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    app.$['android:usesCleartextTraffic'] = 'false';
    const permissions = (manifest['uses-permission'] ?? []).filter(p =>
      !['android.permission.ACCESS_FINE_LOCATION', 'android.permission.NEARBY_WIFI_DEVICES']
        .includes(p.$['android:name']));
    const location = { $: { 'android:name': 'android.permission.ACCESS_FINE_LOCATION',
      'android:maxSdkVersion': '32' } };
    const nearby = { $: { 'android:name': 'android.permission.NEARBY_WIFI_DEVICES',
      'android:usesPermissionFlags': 'neverForLocation' } };
    permissions.push(location, nearby);
    manifest['uses-permission'] = permissions;
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    for (const variant of ['main', 'debug']) {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src', variant, 'res/xml');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'network_security_config.xml'), configXml(variant === 'debug'));
    }
    return mod;
  }]);
};
module.exports = withCarApp;
