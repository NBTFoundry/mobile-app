// SPDX-License-Identifier: MPL-2.0
// Plain JavaScript, like withCarApp.js: app.config.ts, the EAS CLI and Jest all load it.
// @ts-check
const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

/**
 * What an over-the-air update must match in the installed app: everything that ends up in the
 * native build. A store build and `eas update` compute the same value from the same commit, so
 * an update only reaches builds whose native side it was written for.
 *
 * - `package.json`: `dependencies` (native libraries) and `expo` (autolinking)
 * - `app.config.ts` (permissions, SDK levels, plugins, the app version), `plugins/`, `assets/`
 * - `modules/<name>/android/` and its `expo-module.config.json`, without generated files;
 *   for iOS `modules/<name>/ios/` instead: one platform's native code never moves the other's
 * - the installer core's inputs: `eas/pins.env`, `eas/build-core.sh`,
 *   `scripts/build-installer-core.sh`
 */
const FILES = ['app.config.ts', 'eas/pins.env', 'eas/build-core.sh', 'scripts/build-installer-core.sh'];
const FOLDERS = ['plugins', 'assets', 'modules'];
const SKIPPED = new Set(['build', 'generated', 'node_modules', '.gradle', '.cxx', '.kotlin']);

/** @param {string} root @param {string} folder @param {string} other @returns {string[]} */
function walk(root, folder, other) {
  /** @type {string[]} */
  const found = [];
  for (const name of readdirSync(path.join(root, folder)).sort()) {
    if (SKIPPED.has(name)) continue;
    // modules/<name>/<the other platform>
    if (name === other && /^modules\/[^/]+$/.test(folder)) continue;
    const relative = `${folder}/${name}`;
    if (statSync(path.join(root, relative)).isDirectory()) found.push(...walk(root, relative, other));
    // A module's TypeScript side travels with an update.
    else if (!(folder.startsWith('modules') && name.endsWith('.ts'))) found.push(relative);
  }
  return found;
}

/**
 * @param {string} root The project folder.
 * @param {'android' | 'ios'} [platform]
 * @returns {string} For example "0.1.0-3fa9c1d2e4b6".
 */
function runtimeVersion(root, platform = 'android') {
  const other = platform === 'ios' ? 'android' : 'ios';
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const hash = createHash('sha256');
  hash.update(JSON.stringify([pkg.dependencies, pkg.expo]));
  if (platform !== 'android') hash.update(platform);
  for (const file of [...FILES, ...FOLDERS.flatMap(folder => walk(root, folder, other))]) {
    hash.update(`\0${file}\0`);
    hash.update(readFileSync(path.join(root, file)));
  }
  return `${pkg.version}-${hash.digest('hex').slice(0, 12)}`;
}

module.exports = { runtimeVersion };
