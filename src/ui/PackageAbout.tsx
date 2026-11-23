// SPDX-License-Identifier: MPL-2.0
/** What a package says about itself for people (`property=` and `text=` lines):
 * shown as the package wrote it, before the car has verified it. */
import { View } from 'react-native';
import type { PackageInfo } from '../protocol/packageHeader';
import { Body } from './kit';

export function PackageAbout({ info }: { info: Pick<PackageInfo, 'properties' | 'text'> }) {
  const properties = info.properties ?? [];
  // An empty text line separates paragraphs.
  const paragraphs = (info.text ?? []).join('\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!properties.length && !paragraphs.length) return null;
  return <View style={{ gap: 4 }}>
    {properties.map((p, i) => <Body key={`p${i}`}>{`${p.label}: ${p.value}`}</Body>)}
    {paragraphs.map((p, i) => <Body key={`t${i}`} muted>{p}</Body>)}
  </View>;
}
