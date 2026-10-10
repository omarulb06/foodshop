import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { LineChart, type LineChartPoint } from '@/components/line-chart';
import { Notice } from '@/components/notice';
import { OptionGroup } from '@/components/option-group';
import { Screen } from '@/components/screen';
import { useResponsive } from '@/hooks/use-responsive';
import { buildRangeSeries, sumStockSeries, type QuantityRange } from '@/lib/charts';
import { copy } from '@/lib/copy';
import { formatBucketLabel } from '@/lib/datetime';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, spacing } from '@/theme';

const RANGES: { value: QuantityRange; label: string }[] = [
  { value: '7d', label: copy.range7 },
  { value: '30d', label: copy.range30 },
  { value: '6m', label: copy.rangeMonths },
];

export default function ChartsScreen() {
  const { products, history } = useInventory();
  const { gutter, isTablet } = useResponsive();
  const [range, setRange] = useState<QuantityRange>('30d');
  const [selected, setSelected] = useState<string>('all');

  const units = useMemo(() => new Set(products.map((product) => product.unit)), [products]);
  const selectedProduct = products.find((product) => product.id === selected);
  const unit =
    selected === 'all' ? (units.size === 1 ? [...units][0] : copy.mixedUnits) : (selectedProduct?.unit ?? '');

  const points = useMemo<LineChartPoint[]>(() => {
    if (selected === 'all') {
      return sumStockSeries(
        products.map((product) =>
          buildRangeSeries(
            history.filter((entry) => entry.productId === product.id),
            range
          )
        )
      ).map((point) => ({ key: point.dayKey, value: point.value }));
    }
    return buildRangeSeries(
      history.filter((entry) => entry.productId === selected),
      range
    ).map((point) => ({ key: point.dayKey, value: point.value }));
  }, [history, products, range, selected]);

  const known = points.filter((point) => point.value !== null).length;
  const middle = points.length > 2 ? points[Math.floor((points.length - 1) / 2)] : undefined;
  const lastPoint = points.length > 0 ? points[points.length - 1] : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: isTablet ? spacing.lg : spacing.md }}>
        <Card title={copy.quantityOverTime} subtitle={copy.quantityChartSubtitle}>
          <OptionGroup label={copy.quantityOverTime} options={RANGES} value={range} onChange={setRange} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.products}>
            <ProductChip
              label={copy.allInventory}
              selected={selected === 'all'}
              onPress={() => setSelected('all')}
            />
            {products.map((product) => (
              <ProductChip
                key={product.id}
                label={product.name}
                selected={selected === product.id}
                onPress={() => setSelected(product.id)}
              />
            ))}
          </ScrollView>

          {products.length === 0 ? (
            <Notice title={copy.emptyShopTitle} message={copy.emptyShopBody} />
          ) : (
            <View style={styles.chartWrapper}>
              <LineChart
                points={points}
                unit={unit}
                startLabel={points[0] ? formatBucketLabel(points[0].key) : ''}
                middleLabel={middle ? formatBucketLabel(middle.key) : undefined}
                endLabel={lastPoint ? formatBucketLabel(lastPoint.key) : copy.today}
                height={isTablet ? 240 : 200}
              />
              {selected === 'all' && units.size > 1 ? (
                <Text style={styles.note}>{copy.mixedUnitsNote}</Text>
              ) : null}
              {known === 0 ? <Text style={styles.note}>{copy.noChartHistory}</Text> : null}
              {known === 1 ? <Text style={styles.note}>{copy.oneChartPoint}</Text> : null}
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function ProductChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}>
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  products: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  chip: {
    maxWidth: 180,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.onPrimary,
  },
  chartWrapper: {
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.md,
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
});
