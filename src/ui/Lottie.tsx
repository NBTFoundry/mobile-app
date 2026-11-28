// SPDX-License-Identifier: MPL-2.0
/** The app's Lottie animations (drawn by scripts/make-lottie.mjs), painted in the theme's
 * colours: what an action is doing, and how it ended. `done` and `failed` play once, the
 * others go round while the action runs. With reduced motion, or `still`, one frame is shown. */
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { View } from 'react-native';
import confirm from './lottie/confirm.json';
import connect from './lottie/connect.json';
import done from './lottie/done.json';
import failed from './lottie/failed.json';
import transfer from './lottie/transfer.json';
import working from './lottie/working.json';
import { useReducedMotion } from './motion';
import { useColors } from './theme';

const SOURCES = { working, connect, transfer, confirm, done, failed } satisfies Record<string, AnimationObject>;
export type LottieName = keyof typeof SOURCES;

/** `mark`: the colour of `done` and `failed` (green and red otherwise). */
export function Lottie({ name, size = 96, still, mark }: { name: LottieName; size?: number; still?: boolean; mark?: string }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const once = name === 'done' || name === 'failed';
  const frozen = still || reduced;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LottieView source={SOURCES[name]} style={{ width: size, height: size }} autoPlay={!frozen} loop={!once}
        // The frame that says it: the finished drawing, or the middle of a loop.
        progress={frozen ? (once ? 1 : 0.5) : undefined}
        colorFilters={[
          { keypath: 'ink', color: colors.text }, { keypath: 'muted', color: colors.muted },
          { keypath: 'line', color: colors.line }, { keypath: 'accent', color: colors.accent },
          { keypath: 'mark', color: mark ?? (name === 'done' ? colors.ok : colors.bad) },
        ]} />
    </View>
  );
}
