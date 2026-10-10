import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { copy } from '@/lib/copy';
import { colors, fontSize, shadow } from '@/theme';

export type WheelSection = 'stock' | 'orders' | 'intake' | 'history';

interface Slice {
  id: WheelSection;
  label: string;
  access: string;
  color: string;
  start: number;
  end: number;
}

const SLICES: Slice[] = [
  { id: 'stock', label: 'מלאי', access: copy.stock, color: '#1B64C4', start: 270, end: 358 },
  { id: 'orders', label: 'הזמנות', access: copy.orders, color: '#2E6F9E', start: 180, end: 268 },
  { id: 'intake', label: 'אספקה', access: copy.supplierDeliveries, color: '#17803D', start: 90, end: 178 },
  { id: 'history', label: 'היסטוריה', access: copy.history, color: '#5C6B7A', start: 2, end: 88 },
];

const SIZE = 292;
const CENTER = SIZE / 2;
const OUTER = 138;
const INNER = 58;

function polar(radius: number, angle: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

function slicePath(start: number, end: number): string {
  const outerStart = polar(OUTER, start);
  const outerEnd = polar(OUTER, end);
  const innerEnd = polar(INNER, end);
  const innerStart = polar(INNER, start);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

interface SectionWheelProps {
  onSelect: (section: WheelSection) => void;
}

export function SectionWheel({ onSelect }: SectionWheelProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState<WheelSection | null>(null);

  const choose = (section: WheelSection) => {
    setPressed(section);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setPressed(null);
      onSelect(section);
    });
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.wheel, { transform: [{ scale }] }]}>
        <Svg width={SIZE} height={SIZE}>
          {SLICES.map((slice) => (
            <Path
              key={slice.id}
              d={slicePath(slice.start, slice.end)}
              fill={pressed === slice.id ? colors.primaryDark : slice.color}
            />
          ))}
          {SLICES.map((slice) => {
            const middle = polar((OUTER + INNER) / 2, (slice.start + slice.end) / 2);
            return (
              <SvgText
                key={`${slice.id}-label`}
                x={middle.x}
                y={middle.y + 5}
                fill={colors.onPrimary}
                fontSize={15}
                fontWeight="700"
                textAnchor="middle">
                {slice.label}
              </SvgText>
            );
          })}
        </Svg>
        <View style={styles.hits} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SLICES[3].access}
            style={styles.hitTopRight}
            onPress={() => choose('history')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SLICES[0].access}
            style={styles.hitTopLeft}
            onPress={() => choose('stock')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SLICES[2].access}
            style={styles.hitBottomRight}
            onPress={() => choose('intake')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SLICES[1].access}
            style={styles.hitBottomLeft}
            onPress={() => choose('orders')}
          />
        </View>
        <View style={styles.hub}>
          <Text style={styles.hubTitle}>{copy.stock}</Text>
        </View>
      </Animated.View>
      <Text style={styles.hint}>{copy.wheelHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  wheel: {
    width: SIZE,
    height: SIZE,
    direction: 'ltr',
    ...shadow.card,
  },
  hub: {
    position: 'absolute',
    top: CENTER - INNER + 8,
    left: CENTER - INNER + 8,
    width: (INNER - 8) * 2,
    height: (INNER - 8) * 2,
    borderRadius: INNER,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTitle: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.text,
  },
  hits: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  hitTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '46%',
  },
  hitTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '46%',
  },
  hitBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '50%',
    height: '46%',
  },
  hitBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '46%',
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
