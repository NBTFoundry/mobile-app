/** The phone's own check of a manager release (`NBTRLS1` or `NBTRLS2`), as the kit
 * ships it for the manager: header, lengths and manifest fields. The car verifies
 * the signature against its installed manager key; until then these are unverified. */
import { ProtocolError, fromAscii, isHex, isU64 } from './bytes';
import type { PackageInfo } from './packageHeader';

export const RELEASE_MAGIC = 'NBTRLS1\n';
export const RELEASE_V2_MAGIC = 'NBTRLS2\n';
const HEADER = 16;
const SIGNATURE = 384;
const COMPONENTS_V1 = ['launcher', 'gui', 'worker', 'plugin_lib', 'plugin_manifest', 'plugin_xml',
  'plugin_text', 'plugin_images'];
const COMPONENTS_V2 = [...COMPONENTS_V1, 'capture_lib'];
const COMPONENT_MAX = 64 * 1024 * 1024;

const bad = (): never => {
  throw new ProtocolError('bad-package');
};

export function parseReleaseHead(head: Uint8Array, fileSize: number): PackageInfo {
  if (head.length < HEADER) bad();
  const magic = fromAscii(head.subarray(0, 8));
  if (magic !== RELEASE_MAGIC && magic !== RELEASE_V2_MAGIC) bad();
  const components = magic === RELEASE_V2_MAGIC ? COMPONENTS_V2 : COMPONENTS_V1;
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
  for (const name of components) {
    const size = field(`${name}_size`);
    if (!/^(0|[1-9][0-9]{0,8})$/.test(size) || Number(size) > COMPONENT_MAX || !isHex(field(`${name}_sha256`), 32)) bad();
    payloadSize += Number(size);
  }
  if (lines.length || !/^[A-Za-z0-9._-]{1,48}$/.test(version) || !isU64(sequence)
    || platform !== 'qnx6.5-armv7le' || !/^[a-z0-9._-]{1,48}$/.test(compat)
    || fileSize !== HEADER + manifestSize + SIGNATURE + payloadSize) bad();
  return { app: 'manager', version, sequence, compat, payloadSize, payloadSha256: '', settings: [] };
}
