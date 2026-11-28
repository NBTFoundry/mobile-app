// SPDX-License-Identifier: MPL-2.0
/** The runtime version an over-the-air update must match: it follows the native side only. */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runtimeVersion } from '../plugins/runtimeVersion';

const root = join(__dirname, '..');
let copy: string;

beforeEach(() => {
  copy = mkdtempSync(join(tmpdir(), 'nbt-runtime-'));
  for (const name of ['package.json', 'app.config.ts']) cpSync(join(root, name), join(copy, name));
  for (const name of ['plugins', 'assets', 'eas']) cpSync(join(root, name), join(copy, name), { recursive: true });
  mkdirSync(join(copy, 'scripts'));
  cpSync(join(root, 'scripts/build-installer-core.sh'), join(copy, 'scripts/build-installer-core.sh'));
  mkdirSync(join(copy, 'modules/car-link/android/src'), { recursive: true });
  writeFileSync(join(copy, 'modules/car-link/android/src/Module.kt'), 'class Module');
  writeFileSync(join(copy, 'modules/car-link/index.ts'), 'export {};');
});
afterEach(() => rmSync(copy, { recursive: true, force: true }));

it('is the app version and a hash, the same each time', () => {
  expect(runtimeVersion(root)).toMatch(/^\d+\.\d+\.\d+-[0-9a-f]{12}$/);
  expect(runtimeVersion(root)).toBe(runtimeVersion(root));
  expect(runtimeVersion(copy)).toBe(runtimeVersion(copy));
});

it('changes with native code, a native dependency, the installer core’s pins and the app config', () => {
  const before = runtimeVersion(copy);
  const changed = (edit: () => void) => {
    edit();
    return runtimeVersion(copy);
  };
  const seen = new Set([before]);
  seen.add(changed(() => writeFileSync(join(copy, 'modules/car-link/android/src/Module.kt'), 'class Module2')));
  seen.add(changed(() => writeFileSync(join(copy, 'eas/pins.env'), 'INSTALLER_REF=other\n')));
  seen.add(changed(() => writeFileSync(join(copy, 'app.config.ts'), '// other')));
  seen.add(changed(() => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    pkg.dependencies['react-native-svg'] = '99.0.0';
    writeFileSync(join(copy, 'package.json'), JSON.stringify(pkg));
  }));
  expect(seen.size).toBe(5);
});

it('stays for what an update can carry: a module’s TypeScript, development tools, generated files', () => {
  const before = runtimeVersion(copy);
  writeFileSync(join(copy, 'modules/car-link/index.ts'), 'export const changed = 1;');
  mkdirSync(join(copy, 'modules/car-link/android/generated'));
  writeFileSync(join(copy, 'modules/car-link/android/generated/lib.so'), 'binary');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  pkg.devDependencies.jest = '99.0.0';
  pkg.scripts.extra = 'true';
  writeFileSync(join(copy, 'package.json'), JSON.stringify(pkg));
  expect(runtimeVersion(copy)).toBe(before);
});
