import type { ColorValue } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type TabIconName = 'stock' | 'history' | 'charts' | 'orders' | 'intake';

interface TabIconProps {
  name: TabIconName;
  /** Comes straight from the navigator, which hands over the active tint. */
  color: ColorValue;
  size?: number;
}

/**
 * Drawn with react-native-svg, which the charts already use, so the app needs no
 * icon font and ships no extra assets.
 */
export function TabIcon({ name, color, size = 26 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'stock' ? (
        <>
          <Rect
            x={3}
            y={7}
            width={18}
            height={13}
            rx={2}
            stroke={color}
            strokeWidth={2}
            fill="none"
          />
          <Path d="M3 7 L5 3 L19 3 L21 7" stroke={color} strokeWidth={2} fill="none" />
          <Line x1={9} y1={12} x2={15} y2={12} stroke={color} strokeWidth={2} />
        </>
      ) : null}

      {name === 'history' ? (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
          <Path
            d="M12 7 L12 12 L16 14"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}

      {name === 'orders' ? (
        <>
          <Rect x={6} y={3} width={12} height={18} rx={2} stroke={color} strokeWidth={2} fill="none" />
          <Path d="M9 2 H15 V6 H9 Z" stroke={color} strokeWidth={2} fill="none" />
          <Line x1={9} y1={11} x2={15} y2={11} stroke={color} strokeWidth={2} />
          <Line x1={9} y1={15} x2={15} y2={15} stroke={color} strokeWidth={2} />
        </>
      ) : null}

      {name === 'intake' ? (
        <>
          <Path d="M3 16 L12 4 L21 16" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
          <Path d="M7 16 L12 10 L17 16" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
          <Line x1={12} y1={10} x2={12} y2={21} stroke={color} strokeWidth={2} />
        </>
      ) : null}

      {name === 'charts' ? (
        <>
          <Line x1={3} y1={21} x2={21} y2={21} stroke={color} strokeWidth={2} />
          <Rect x={5} y={12} width={4} height={7} fill={color} />
          <Rect x={11} y={7} width={4} height={12} fill={color} />
          <Rect x={17} y={14} width={4} height={5} fill={color} />
        </>
      ) : null}
    </Svg>
  );
}
