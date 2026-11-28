// SPDX-License-Identifier: MPL-2.0
/** The phone and the car's screen, and the link between them: dots that run while the link is
 * being made, stay lit when it holds and dim when there is none. */
import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useReducedMotion, type LinkState } from './motion';
import { useColors } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const DOTS = [76, 90, 104, 118];

export function CarHero({ state }: { state: LinkState }) {
  const colors = useColors();
  const still = useReducedMotion();
  const [phase] = useState(() => new Animated.Value(0));
  const running = state === 'busy' && !still;
  useEffect(() => {
    if (!running) {
      phase.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [running, phase]);
  const lit = state === 'on' ? 1 : 0.25;
  return (
    <Svg width="100%" height={84} viewBox="0 0 300 92" fill="none" strokeLinecap="round" strokeLinejoin="round"
      accessibilityElementsHidden importantForAccessibility="no">
      <Rect x={26} y={20} width={32} height={58} rx={6} stroke={colors.muted} strokeWidth={2} />
      <Path d="M38 71h8" stroke={colors.muted} strokeWidth={2} />
      {DOTS.map((cx, i) => {
        // Each dot lights a little after the one before it.
        const start = 0.05 + i * 0.18;
        return running
          ? <AnimatedCircle key={cx} cx={cx} cy={49} r={3} fill={colors.accent}
            opacity={phase.interpolate({ inputRange: [0, start, start + 0.1, start + 0.38, 1], outputRange: [0.2, 0.2, 1, 0.2, 0.2] })} />
          : <Circle key={cx} cx={cx} cy={49} r={3} fill={state === 'off' ? colors.muted : colors.accent} opacity={lit} />;
      })}
      <Rect x={136} y={14} width={140} height={58} rx={6} stroke={colors.text} strokeWidth={2} />
      <Rect x={148} y={28} width={30} height={30} rx={4} fill={colors.fill} opacity={state === 'off' ? 0.45 : 1} />
      <Rect x={186} y={28} width={30} height={30} rx={4} fill={colors.line} />
      <Rect x={224} y={28} width={30} height={30} rx={4} fill={colors.line} />
      <Path d="M190 80h32M206 72v8" stroke={colors.muted} strokeWidth={2} />
    </Svg>
  );
}
