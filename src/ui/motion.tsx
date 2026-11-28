// SPDX-License-Identifier: MPL-2.0
/** The app's own small movements, each tied to a state: a link that pulses while it is being
 * made, rows that stand in for a list being read, a line that runs while an action does, and
 * screens that slide in. The pictures of an action are Lottie animations (Lottie.tsx). None of them moves when the phone asks for
 * reduced motion (Android: Remove animations). */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { useColors, useStyles } from './theme';

let reduced = false;
let watching = false;
const listeners = new Set<() => void>();

function watch(): void {
  if (watching) return;
  watching = true;
  const apply = (on: boolean) => {
    if (on === reduced) return;
    reduced = on;
    listeners.forEach(listener => listener());
  };
  void AccessibilityInfo.isReduceMotionEnabled().then(apply, () => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
}

/** Whether the phone asks for reduced motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(listener => {
    watch();
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => reduced);
}

/** 0 to 1 again and again while `running`, each round taking `ms`; still at 0 otherwise. */
function useLoop(running: boolean, ms: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  const still = useReducedMotion();
  useEffect(() => {
    if (!running || still) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.quad),
      useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [running, still, ms, value]);
  return value;
}

export type LinkState = 'on' | 'busy' | 'off';

/** The car's link: steady when connected, a ring spreading while it is being made. */
export function LinkDot({ state }: { state: LinkState }) {
  const colors = useColors();
  const loop = useLoop(state === 'busy', 1200);
  const color = state === 'on' ? colors.ok : state === 'busy' ? colors.warn : colors.muted;
  return (
    <View style={styles.dotBox}>
      {state === 'busy' ? <Animated.View style={[styles.dot, { backgroundColor: color, position: 'absolute',
        opacity: loop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: loop.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }]} /> : null}
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/** Rows standing in for a list while it is read. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const sheet = useStyles(makeStyles);
  const loop = useLoop(true, 1100);
  const opacity = loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] });
  return (
    <Animated.View style={{ opacity }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={sheet.skeletonRow}>
          <View style={sheet.skeletonIcon} />
          <View style={styles.skeletonText}>
            <View style={[sheet.skeletonLine, { width: '55%' }]} />
            <View style={[sheet.skeletonLine, { width: '30%' }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/** A line running along the bottom edge of what holds it, while an action runs. */
export function RunLine() {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const loop = useLoop(width > 0, 1500);
  return (
    <View style={styles.runTrack} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[styles.runLine, { backgroundColor: colors.glow, width: width * 0.4,
        transform: [{ translateX: loop.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width] }) }] }]} />
    </View>
  );
}

/** A screen that slides in when it appears: from the right going deeper, from the left coming
 * back, in place between tabs. Give it a `key` that changes with the screen. */
export function Enter({ from, style, children }: { from: 'right' | 'left' | 'none'; style?: ViewStyle; children: ReactNode }) {
  const still = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) shown.setValue(1);
    else Animated.timing(shown, { toValue: 1, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shown, still]);
  const shift = from === 'none' ? 0 : from === 'right' ? 28 : -28;
  return (
    <Animated.View style={[style, { opacity: shown,
      transform: [{ translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dotBox: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  skeletonText: { flex: 1, gap: 8 },
  runTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden' },
  runLine: { height: 2 },
});

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  skeletonIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.line },
  skeletonLine: { height: 9, borderRadius: 4, backgroundColor: colors.line },
});
