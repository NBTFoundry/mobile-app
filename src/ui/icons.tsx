// SPDX-License-Identifier: MPL-2.0
/** Line icons on a 24-unit grid, drawn here: no icon font and no image files. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from './theme';

type Shape = string | ['c', number, number, number] | ['r', number, number, number, number, number];

const ICONS = {
  apps: [['r', 4, 4, 7, 7, 1.5], ['r', 13, 4, 7, 7, 1.5], ['r', 4, 13, 7, 7, 1.5], ['r', 13, 13, 7, 7, 1.5]],
  car: [['r', 3, 6, 18, 10, 2], 'M9 20h6M12 16v4'],
  more: [['c', 5, 12, 1.2], ['c', 12, 12, 1.2], ['c', 19, 12, 1.2]],
  activity: ['M3 12h4l3-7 4 14 3-7h4'],
  download: ['M12 4v11M7 11l5 5 5-5M5 20h14'],
  globe: [['c', 12, 12, 9], 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  theme: [['c', 12, 12, 9], 'M12 3v18M12 7.5h7.8M12 12h9M12 16.5h7.8'],
  flask: ['M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3'],
  plug: ['M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5'],
  check: [['c', 12, 12, 9], 'M8 12l3 3 5-6'],
  alert: ['M12 4l9 16H3zM12 10v4M12 17v.5'],
  logs: ['M5 6h14M5 12h14M5 18h9'],
  key: [['c', 8, 15, 4], 'M11 12l8-8M16 7l3 3'],
  sliders: ['M4 7h10M18 7h2M4 17h2M10 17h10', ['c', 16, 7, 2], ['c', 8, 17, 2]],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  info: [['c', 12, 12, 9], 'M12 11v6M12 7.5v.5'],
  help: [['c', 12, 12, 9], ['c', 12, 12, 4], 'M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6'],
  pen: ['M4 20h4L19 9l-4-4L4 16z'],
  phone: [['r', 7, 3, 10, 18, 2.5], 'M11 17.5h2'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'],
  chart: ['M4 20V10M10 20V4M16 20v-7M21 20H3'],
  cars: [['r', 3, 9, 18, 8, 2], 'M6 9l2-4h8l2 4M7 17v2M17 17v2'],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors();
  const stroke = color ?? colors.accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no">
      {(ICONS[name] as readonly Shape[]).map((shape, i) => (typeof shape === 'string' ? <Path key={i} d={shape} />
        : shape[0] === 'c' ? <Circle key={i} cx={shape[1]} cy={shape[2]} r={shape[3]} />
          : <Rect key={i} x={shape[1]} y={shape[2]} width={shape[3]} height={shape[4]} rx={shape[5]} />))}
    </Svg>
  );
}
