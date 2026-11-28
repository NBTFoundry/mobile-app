// SPDX-License-Identifier: MPL-2.0
/** Shared typography, surfaces and large touch targets, in the selected car's theme (theme.ts). */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icons';
import { Lottie } from './Lottie';
import { useColors, useStyles } from './theme';
export { useColors, useStyles } from './theme';

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export function Title({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.title} accessibilityRole="header">{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.heading} accessibilityRole="header">{children}</Text>;
}

/** A line that leads a panel: what it is about. */
export function Strong({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.rowTitle}>{children}</Text>;
}

/** `lines`: no more than that many, the last one ending in an ellipsis. */
export function Body({ children, muted, lines }: { children: ReactNode; muted?: boolean; lines?: number }) {
  const styles = useStyles(makeStyles);
  return <Text numberOfLines={lines} style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

/** A small heading over a title or a section, after the theme's slanted bar; `plain` for a
 * sentence (a question, a value), which keeps its case and has no bar. */
export function Label({ children, plain }: { children: ReactNode; plain?: boolean }) {
  const styles = useStyles(makeStyles);
  if (plain) return <Text style={styles.label}>{children}</Text>;
  return (
    <View style={styles.eyebrow}>
      <View style={styles.eyebrowBar} />
      <Text style={[styles.label, styles.eyebrowText]}>{children}</Text>
    </View>
  );
}

type ButtonProps = { label: string; onPress: () => void; kind?: 'primary' | 'plain' | 'danger'; disabled?: boolean; expanded?: boolean };

export function Button({ label, onPress, kind = 'primary', disabled, expanded }: ButtonProps) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, expanded }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[kind], disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, kind === 'primary' && styles.primaryText, kind === 'danger' && styles.dangerText]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** A line of a list. `icon`: what stands before it; `value`: a short muted text at its end;
 * `right`: what replaces the chevron (a pill, a switch); `children`: under the detail. */
export function Row({ title, detail, detailLines, tag, tagColor, onPress, expanded, icon, value, right, compact, children }: {
  title: string; detail?: string; detailLines?: number; tag?: string; tagColor?: string; onPress?: () => void; expanded?: boolean;
  icon?: ReactNode; value?: string; right?: ReactNode; compact?: boolean; children?: ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityState={{ expanded }}
      style={({ pressed }) => [styles.row, compact && styles.rowCompact, pressed && styles.pressed]}>
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text numberOfLines={detailLines} style={styles.rowDetail}>{detail}</Text> : null}
        {children}
      </View>
      {value ? <Text numberOfLines={1} style={styles.rowValue}>{value}</Text> : null}
      {tag ? <Text style={[styles.tag, { color: tagColor ?? colors.muted, borderColor: tagColor ?? colors.line }]}>{tag}</Text> : null}
      {right ?? (onPress ? <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>›</Text> : null)}
    </Pressable>
  );
}

/** A line icon on a small tile, before a row. */
export function IconTile({ name, small }: { name: IconName; small?: boolean }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.tile, small && styles.tileSmall]}><Icon name={name} size={small ? 18 : 20} /></View>;
}

/** A small button at the end of a row: the row's next step. */
export function Pill({ label, onPress, filled, disabled }: { label: string; onPress: () => void; filled?: boolean; disabled?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={10}
      style={({ pressed }) => [styles.pill, filled && styles.pillFilled, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.pillText, filled && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

/** An on/off switch at the end of a row; the row itself is pressed too. */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  const colors = useColors();
  return <Switch value={on} onValueChange={onChange} disabled={disabled} accessibilityLabel={label}
    trackColor={{ false: colors.line, true: colors.fill }} thumbColor={on ? colors.fillText : colors.muted} />;
}

/** The main button while its action runs: it fills as `value` goes from 0 to 1. */
export function ProgressButton({ label, value }: { label: string; value: number }) {
  const styles = useStyles(makeStyles);
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View style={[styles.button, styles.progressButton]} accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <View style={styles.progressTrack} />
      <View style={[styles.progressFill, { width: `${percent}%` }]} />
      <Text style={[styles.buttonText, styles.primaryText]}>{label}</Text>
    </View>
  );
}

/** A label over a group of rows. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={{ gap: 4 }}><Label>{title}</Label><View>{children}</View></View>;
}

export function Busy({ text }: { text: string }) {
  const styles = useStyles(makeStyles);
  return <View style={styles.busy}><Lottie name="working" size={24} /><View style={{ flex: 1 }}><Body muted>{text}</Body></View></View>;
}

export function Progress({ value }: { value: number }) {
  const styles = useStyles(makeStyles);
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={styles.track}><View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }]} /></View>;
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8, lineHeight: 35 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
  muted: { color: colors.muted },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowBar: { width: 20, height: 3, backgroundColor: colors.glow, transform: [{ skewX: '-24deg' }] },
  eyebrowText: { flexShrink: 1, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  button: { minHeight: 48, borderRadius: colors.corner, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: colors.fill },
  plain: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  buttonText: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  primaryText: { color: colors.fillText },
  dangerText: { color: colors.bad },
  panel: { backgroundColor: colors.panel, borderRadius: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
    padding: 20, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowCompact: { minHeight: 52, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 120, gap: 3 },
  rowValue: { color: colors.muted, fontSize: 14, flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  tile: { width: 38, height: 38, borderRadius: Math.min(colors.corner + 4, 12), backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  tileSmall: { width: 34, height: 34 },
  pill: { minHeight: 34, minWidth: 64, paddingHorizontal: 14, borderRadius: colors.corner, borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center' },
  pillFilled: { backgroundColor: colors.fill, borderColor: colors.fill },
  pillText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  progressButton: { overflow: 'hidden' },
  progressTrack: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.fill, opacity: 0.45 },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.fill },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 24 },
  rowDetail: { color: colors.muted, fontSize: 14 },
  tag: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1,
    borderWidth: 1, borderRadius: Math.min(colors.corner, 10), paddingHorizontal: 7, paddingVertical: 2 },
  busy: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  track: { height: 6, borderRadius: Math.min(colors.corner, 3), backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
});
