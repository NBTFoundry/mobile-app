// SPDX-License-Identifier: MPL-2.0
/** What a package says about itself for people (`property=` and `text=` lines),
 * and what it may do to the car (its permissions, protocol/permissions.ts):
 * shown as the package declares them, before the car has verified it. */
import { View } from 'react-native';
import { t, type Key } from '../i18n';
import { permissionLabels } from '../protocol/permissions';
import type { PackageInfo } from '../protocol/packageHeader';
import { Body } from './kit';

function permissionLines(bits: number | undefined): string[] {
  if (!bits) return [];
  const { uses, can, driving } = permissionLabels(bits);
  const join = (keys: string[]) => keys.map(k => t(k as Key)).join(t('perm.separator'));
  const lines: string[] = [];
  if (uses.length) lines.push(t('perm.uses', { list: join(uses) }));
  if (can.length) {
    const how = driving === undefined ? '' : ` ${t(driving ? 'perm.driving' : 'perm.parked')}`;
    lines.push(t('perm.can', { list: join(can) + how }));
  }
  return lines;
}

export function PackageAbout({ info }: { info: Pick<PackageInfo, 'properties' | 'text' | 'permissions'> }) {
  const properties = info.properties ?? [];
  const permissions = permissionLines(info.permissions);
  // An empty text line separates paragraphs.
  const paragraphs = (info.text ?? []).join('\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!properties.length && !paragraphs.length && !permissions.length) return null;
  return <View style={{ gap: 4 }}>
    {properties.map((p, i) => <Body key={`p${i}`}>{`${p.label}: ${p.value}`}</Body>)}
    {permissions.map((line, i) => <Body key={`r${i}`}>{line}</Body>)}
    {paragraphs.map((p, i) => <Body key={`t${i}`} muted>{p}</Body>)}
  </View>;
}
