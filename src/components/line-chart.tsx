import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { copy } from '@/lib/copy';
import { formatQuantity } from '@/lib/quantity';
import { colors, fontSize, spacing } from '@/theme';

export interface LineChartPoint {
  key: string;
  /** `null` for days before the product existed, which leaves a gap. */
  value: number | null;
}

interface LineChartProps {
  points: LineChartPoint[];
  /** Printed next to the axis values so quantities are never unit-less. */
  unit: string;
  startLabel: string;
  middleLabel?: string;
  endLabel: string;
  height?: number;
}

const AXIS_WIDTH = 56;

interface PlotPoint {
  x: number;
  y: number;
  index: number;
}

/** A short cardinal spline so the quantity line bends instead of kinking. */
function smoothPath(points: PlotPoint[]): string {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const control1x = current.x + (next.x - previous.x) / 6;
    const control1y = current.y + (next.y - previous.y) / 6;
    const control2x = next.x - (after.x - current.x) / 6;
    const control2y = next.y - (after.y - current.y) / 6;
    path += ` C ${control1x} ${control1y}, ${control2x} ${control2y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function LineChart({
  points,
  unit,
  startLabel,
  middleLabel,
  endLabel,
  height = 200,
}: LineChartProps) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const known = points
    .map((point, index) => ({ index, value: point.value }))
    .filter((point): point is { index: number; value: number } => point.value !== null);

  const values = known.map((point) => point.value);
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const rawMax = values.length > 0 ? Math.max(...values) : 1;
  const min = rawMin === rawMax ? Math.max(0, rawMin - 1) : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;

  const topPadding = 12;
  const bottomPadding = 12;
  const plotLeft = 8;
  const plotHeight = Math.max(10, height - topPadding - bottomPadding);
  const plotWidth = Math.max(10, width - AXIS_WIDTH - plotLeft);
  const lastIndex = Math.max(1, points.length - 1);

  const xFor = (index: number) => plotLeft + (index / lastIndex) * plotWidth;
  const yFor = (value: number) => topPadding + plotHeight - ((value - min) / (max - min)) * plotHeight;
  const axisX = plotLeft + plotWidth + 8;

  const plotted: PlotPoint[] = known.map((point) => ({
    index: point.index,
    x: xFor(point.index),
    y: yFor(point.value),
  }));
  const latest = known.length > 0 ? known[known.length - 1] : null;

  return (
    <View onLayout={onLayout} style={styles.ltr} accessibilityLabel={copy.quantityOverTime}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[max, (max + min) / 2, min].map((value, index) => {
            const y = yFor(value);
            return (
              <Line
                key={`grid-${index}`}
                x1={plotLeft}
                y1={y}
                x2={plotLeft + plotWidth}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray={index === 2 ? undefined : '4 4'}
              />
            );
          })}

          {[max, min].map((value, index) => (
            <SvgText
              key={`axis-${index}`}
              x={axisX}
              y={yFor(value) + 4}
              fontSize={12}
              fill={colors.textMuted}
              textAnchor="start">
              {formatQuantity(value)}
            </SvgText>
          ))}

          {plotted.length > 1 ? (
            <Path
              d={smoothPath(plotted)}
              fill="none"
              stroke={colors.chart}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {plotted.map((point) => (
            <Circle
              key={`dot-${point.index}`}
              cx={point.x}
              cy={point.y}
              r={point.index === latest?.index ? 5 : 2.5}
              fill={colors.chart}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>{startLabel}</Text>
        {middleLabel ? <Text style={styles.footerLabel}>{middleLabel}</Text> : null}
        <Text style={styles.footerUnit}>{copy.measuredIn(unit)}</Text>
        <Text style={styles.footerLabel}>{endLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Time still moves from older on the left to newer on the right, while the
  // quantity axis sits on the right, which is the start edge of the Hebrew page.
  ltr: {
    direction: 'ltr',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  footerLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.text,
  },
  footerUnit: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
