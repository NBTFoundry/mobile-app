// SPDX-License-Identifier: MPL-2.0
/** The phone's own check of a manager release (`NBTRLS1` to `NBTRLS3`), as the kit
 * ships it for the manager: header, lengths and manifest fields. The car verifies
 * the signature against its installed manager key; until then these are unverified.
 * NBTRLS3 names up to eight components after the fixed roles (the manager's
 * docs/manager-release.md). */
import { ProtocolError, fromAscii, isHex, isU64 } from './bytes';
import type { PackageInfo } from './packageHeader';

export const RELEASE_MAGICS = ['NBTRLS1\n', 'NBTRLS2\n', 'NBTRLS3\n'];
const HEADER = 16;
const SIGNATURE = 384;
const COMPONENTS_V1 = ['launcher', 'gui', 'worker', 'plugin_lib', 'plugin_manifest', 'plugin_xml',
  'plugin_text', 'plugin_images'];
const COMPONENT_MAX = 64 * 1024 * 1024;
const NAMED_MAX = 8;
const NAME = /^([a-z][a-z0-9_]{0,23})_size=/;

const bad = (): never => {
  throw new ProtocolError('bad-package');
};

export function parseReleaseHead(head: Uint8Array, fileSize: number): PackageInfo {
  if (head.length < HEADER) bad();
  const magic = fromAscii(head.subarray(0, 8));
  const format = RELEASE_MAGICS.indexOf(magic) + 1;
  if (!format) bad();
  const components = format === 2 ? [...COMPONENTS_V1, 'capture_lib'] : [...COMPONENTS_V1];
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const manifestSize = view.getUint32(8);
  if (!manifestSize || view.getUint32(12) !== SIGNATURE || head.length < HEADER + manifestSize) bad();
  const text = fromAscii(head.subarray(HEADER, HEADER + manifestSize));
  if (!text.endsWith('\n')) bad();
  const lines = text.slice(0, -1).split('\n');
  const field = (name: string): string => {
    const line = lines.shift() ?? '';
    if (!line.startsWith(name + '=')) bad();
    return line.slice(name.length + 1);
  };
  const version = field('version');
  const sequence = field('sequence');
  const platform = field('platform');
  const compat = field('compat');
  while (lines[0]?.startsWith('bridge=')) lines.shift();
  let payloadSize = 0;
  for (let index = 0; index < components.length || (format === 3 && lines.length); index++) {
    if (index === components.length) {
      const name = NAME.exec(lines[0] ?? '')?.[1];
      if (!name || components.includes(name) || components.length === COMPONENTS_V1.length + NAMED_MAX) bad();
      components.push(name!);
    }
    const name = components[index];
    const size = field(`${name}_size`);
    if (!/^(0|[1-9][0-9]{0,8})$/.test(size) || Number(size) > COMPONENT_MAX || !isHex(field(`${name}_sha256`), 32)) bad();
    payloadSize += Number(size);
  }
  if (lines.length || !/^[A-Za-z0-9._-]{1,48}$/.test(version) || !isU64(sequence)
    || platform !== 'qnx6.5-armv7le' || !/^[a-z0-9._-]{1,48}$/.test(compat)
    || fileSize !== HEADER + manifestSize + SIGNATURE + payloadSize) bad();
  return { app: 'manager', version, sequence, compat, payloadSize, payloadSha256: '', settings: [], format };
}
