import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { Card } from '@/components/card';
import { HistoryEntryRow } from '@/components/history-entry-row';
import { LineChart, type LineChartPoint } from '@/components/line-chart';
import { Notice } from '@/components/notice';
import { OptionGroup } from '@/components/option-group';
import { Screen } from '@/components/screen';
import { useResponsive } from '@/hooks/use-responsive';
import { buildRangeSeries, type QuantityRange } from '@/lib/charts';
import { copy } from '@/lib/copy';
import { formatBucketLabel, formatDate, formatRelativeDateTime } from '@/lib/datetime';
import { formatQuantity } from '@/lib/quantity';
import { availableQuantity, isLowStock } from '@/lib/stock';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, spacing } from '@/theme';

const VISIBLE_RECORDS = 12;

const RANGES: { value: QuantityRange; label: string }[] = [
  { value: '7d', label: copy.range7 },
  { value: '30d', label: copy.range30 },
  { value: '6m', label: copy.rangeMonths },
];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getProduct, getProductHistory, deleteProduct } = useInventory();
  const { gutter, isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const [removed, setRemoved] = useState(false);
  const [range, setRange] = useState<QuantityRange>('30d');

  const product = getProduct(id);
  const entries = useMemo(() => getProductHistory(id), [getProductHistory, id]);

  const points = useMemo<LineChartPoint[]>(
    () =>
      buildRangeSeries(entries, range).map((point) => ({
        key: point.dayKey,
        value: point.value,
      })),
    [entries, range]
  );
  const knownPoints = points.filter((point) => point.value !== null).length;

  const leaveScreen = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (!product) {
    if (removed) return <View style={styles.blank} />;
    return (
      <Screen
        width="form"
        style={{ padding: gutter, paddingBottom: gutter + insets.bottom, gap: spacing.lg }}>
        <Notice title={copy.productGoneTitle} message={copy.productGoneBody} />
        <AppButton label={copy.backToStock} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const onDelete = () => {
    const count = entries.length;
    Alert.alert(copy.deleteTitle(product.name), copy.deleteBody(count), [
        { text: copy.keepProduct, style: 'cancel' },
        {
          text: copy.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              setRemoved(true);
              leaveScreen();
            } catch (error) {
              Alert.alert(
                copy.productNotDeleted,
                error instanceof Error ? error.message : copy.nothingChanged
              );
            }
          },
        },
      ]
    );
  };

  const latest = entries[0];

  return (
    <Screen>
      <Stack.Screen options={{ title: product.name }} />
      <ScrollView
        contentContainerStyle={{
          padding: gutter,
          paddingBottom: gutter + insets.bottom,
          gap: isTablet ? spacing.lg : spacing.md,
        }}>
        <Card>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.quantityRow}>
            <Text style={styles.quantity}>{formatQuantity(availableQuantity(product))}</Text>
            <Text style={styles.unit}>{copy.availableStock}</Text>
          </View>
          <Text style={styles.meta}>
            {copy.stockLine(
              formatQuantity(product.quantity),
              formatQuantity(product.reservedQuantity),
              formatQuantity(Math.max(0, availableQuantity(product)))
            )}{' '}
            {product.unit}
          </Text>
          <Text style={styles.meta}>
            {copy.reservedStock}: {formatQuantity(product.reservedQuantity)} {product.unit}
          </Text>
          <Text style={styles.meta}>
            {copy.lowStockThreshold}: {formatQuantity(product.minStockLimit)} {product.unit}
          </Text>
          {isLowStock(product) ? <Text style={styles.low}>{copy.lowStock}</Text> : null}
          <Text style={styles.meta}>
            {copy.sku}: {product.id}
          </Text>
          <Text style={styles.meta}>{copy.addedOn(formatDate(product.createdAt))}</Text>
          <Text style={styles.meta}>
            {latest
              ? copy.lastChange(formatRelativeDateTime(latest.savedAt), latest.actor)
              : copy.noChangesYet}
          </Text>
        </Card>

        <View style={[styles.actions, isTablet ? styles.actionsRow : null]}>
          <AppButton
            label={copy.updateStock}
            onPress={() =>
              router.push({ pathname: '/update-stock', params: { productId: product.id } })
            }
            style={styles.action}
          />
          <AppButton
            label={copy.editProduct}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/product/[id]/edit', params: { id: product.id } })
            }
            style={styles.action}
          />
        </View>

        <Card title={copy.quantityOverTime} subtitle={copy.quantityChartSubtitle}>
          <OptionGroup options={RANGES} value={range} onChange={setRange} />
          <View style={styles.chartWrapper}>
            <LineChart
              points={points}
              unit={product.unit}
              startLabel={points[0] ? formatBucketLabel(points[0].key) : ''}
              middleLabel={
                points.length > 2
                  ? formatBucketLabel(points[Math.floor((points.length - 1) / 2)].key)
                  : undefined
              }
              endLabel={points.length > 0 ? formatBucketLabel(points[points.length - 1].key) : copy.today}
              height={isTablet ? 240 : 200}
            />
          </View>
          {knownPoints === 0 ? (
            <Text style={styles.chartHint}>{copy.noChartHistory}</Text>
          ) : knownPoints === 1 ? (
            <Text style={styles.chartHint}>{copy.oneChartPoint}</Text>
          ) : null}
        </Card>

        <Card title={copy.stockHistory} subtitle={copy.savedRecords(entries.length)}>
          {entries.length === 0 ? (
            <Text style={styles.chartHint}>{copy.nothingForProduct}</Text>
          ) : (
            <View style={styles.entries}>
              {entries.slice(0, VISIBLE_RECORDS).map((entry) => (
                <View key={entry.id} style={styles.entry}>
                  <HistoryEntryRow
                    entry={entry}
                    productName={product.name}
                    showProductName={false}
                    showTimestamp
                  />
                </View>
              ))}
            </View>
          )}
          {entries.length > VISIBLE_RECORDS ? (
            <AppButton
              label={copy.seeAllRecords(entries.length)}
              variant="secondary"
              size="medium"
              onPress={() => router.push({ pathname: '/history', params: { productId: product.id } })}
              style={styles.seeAll}
            />
          ) : null}
        </Card>

        <AppButton label={copy.deleteProduct} variant="danger" onPress={onDelete} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: colors.background,
  },
  name: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quantity: {
    fontSize: fontSize.display,
    fontWeight: '700',
    color: colors.text,
  },
  unit: {
    fontSize: fontSize.bodyLarge,
    color: colors.textMuted,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  low: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  actions: {
    gap: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  action: {
    flex: 1,
  },
  chartWrapper: {
    marginTop: spacing.lg,
  },
  chartHint: {
    marginTop: spacing.md,
    fontSize: fontSize.caption,
    lineHeight: 20,
    color: colors.textMuted,
  },
  entries: {
    marginTop: spacing.sm,
  },
  entry: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  seeAll: {
    marginTop: spacing.md,
  },
});
