// SPDX-License-Identifier: MPL-2.0
import { defineConfig } from 'eslint/config';
import expo from 'eslint-config-expo/flat.js';

export default defineConfig([
  expo,
  { ignores: ['android/**', 'ios/**', 'build/**', 'dist/**'] },
]);
