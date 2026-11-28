// SPDX-License-Identifier: MPL-2.0
/** An application's icon: the website's for an application of the catalog (bundled,
 * appIcons.ts), NBTFoundry's mark for NBT Manager, else the name's first letter on a colour
 * of its own. Nothing is fetched. */
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { APP_ICONS, MARK, MARK_ACCENT, MARK_INK } from './appIcons';
import { useColors } from './theme';

/** A hue that stays the same for an application id. */
export function hueOf(id: string): number {
  let sum = 0;
  for (const ch of id) sum = (sum * 31 + ch.charCodeAt(0)) % 360;
  return sum;
}

export function Mark({ size }: { size: number }) {
  const colors = useColors();
  return <SvgXml width={size} height={size}
    xml={MARK.replaceAll(MARK_INK, colors.text).replaceAll(MARK_ACCENT, colors.accent)} />;
}

export function AppIcon({ id, name, size = 40 }: { id: string; name?: string; size?: number }) {
  if (id === 'manager') return <Mark size={size} />;
  const xml = APP_ICONS[id];
  if (xml) return <SvgXml width={size} height={size} xml={xml} />;
  const letter = (name ?? id).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '?';
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.16,
      backgroundColor: `hsl(${hueOf(id)}, 42%, 34%)` }]}>
      <Text style={[styles.letter, { fontSize: size * 0.48 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#ffffff', fontWeight: '700' },
});
