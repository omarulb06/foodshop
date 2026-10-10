import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { SectionWheel, type WheelSection } from '@/components/section-wheel';
import { SyncBanner } from '@/components/sync-banner';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { formatQuantity } from '@/lib/quantity';
import { availableQuantity, isLowStock } from '@/lib/stock';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';
import type { Product } from '@/types';

type GridItem = { kind: 'product'; product: Product } | { kind: 'filler'; id: string };

export default function StockScreen() {
  const router = useRouter();
  const { products } = useInventory();
  const { columns, gutter, isTablet } = useResponsive();
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low'>('all');

  const openSection = (section: WheelSection) => {
    if (section === 'orders') router.navigate('/orders');
    if (section === 'intake') router.navigate('/intakes');
    if (section === 'history') router.navigate('/history');
  };

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((product) => {
      if (stockFilter === 'low' && !isLowStock(product)) return false;
      if (!search) return true;
      return (
        product.name.toLowerCase().includes(search) || product.unit.toLowerCase().includes(search)
      );
    });
  }, [products, query, stockFilter]);

  // Invisible fillers keep the last row of the tablet grid the same width as
  // the rows above it.
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = visible.map((product) => ({ kind: 'product', product }));
    const remainder = items.length % columns;
    if (columns > 1 && items.length > 0 && remainder !== 0) {
      for (let index = 0; index < columns - remainder; index += 1) {
        items.push({ kind: 'filler', id: `filler-${index}` });
      }
    }
    return items;
  }, [visible, columns]);

  return (
    <Screen>
      <FlatList
        key={`columns-${columns}`}
        data={gridItems}
        keyExtractor={(item) => (item.kind === 'product' ? item.product.id : item.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: gutter } : undefined}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
          { padding: gutter, gap: isTablet ? spacing.lg : spacing.md },
        ]}
        ListHeaderComponent={
          <View style={[styles.header, { gap: spacing.md, marginBottom: gutter }]}>
            <SyncBanner />
            <SectionWheel onSelect={(section) => openSection(section)} />
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={copy.searchProducts}
              accessibilityLabel={copy.searchProducts}
            />
            <AppButton label={copy.scanBarcode} onPress={() => router.push('/scan')} />
            <View style={[styles.actions, isTablet ? styles.actionsRow : null]}>
              <AppButton
                label={copy.updateStock}
                variant="secondary"
                onPress={() => router.push('/update-stock')}
                style={styles.action}
              />
              <AppButton
                label={copy.addProduct}
                variant="secondary"
                onPress={() => router.push('/add-product')}
                style={styles.action}
              />
            </View>
            <View style={styles.filters}>
              <FilterChip
                label={copy.allStock}
                selected={stockFilter === 'all'}
                onPress={() => setStockFilter('all')}
              />
              <FilterChip
                label={copy.lowStock}
                selected={stockFilter === 'low'}
                onPress={() => setStockFilter('low')}
              />
            </View>
            <Text style={styles.count}>
              {products.length === 0
                ? copy.noProductsYet
                : stockFilter === 'low'
                  ? copy.lowStockCount(visible.length)
                  : query.trim()
                    ? copy.productsFiltered(visible.length, products.length)
                    : copy.productsAlpha(products.length)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          products.length === 0 ? (
            <Notice title={copy.emptyShopTitle} message={copy.emptyShopBody} />
          ) : stockFilter === 'low' && !query.trim() ? (
            <Notice title={copy.noLowStockTitle} message={copy.noLowStockBody} />
          ) : (
            <Notice title={copy.noSearchTitle} message={copy.noSearchBody(query.trim())} />
          )
        }
        renderItem={({ item }) =>
          item.kind === 'filler' ? (
            <View style={styles.rowGrow} />
          ) : (
            <ProductRow
              product={item.product}
              onPress={() =>
                router.push({ pathname: '/product/[id]', params: { id: item.product.id } })
              }
              grow={columns > 1}
            />
          )
        }
      />
    </Screen>
  );
}

function FilterChip({
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
      style={[styles.filter, selected ? styles.filterSelected : null]}>
      <Text style={[styles.filterLabel, selected ? styles.filterLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function ProductRow({
  product,
  onPress,
  grow,
}: {
  product: Product;
  onPress: () => void;
  grow: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${copy.stockLine(
        formatQuantity(product.quantity),
        formatQuantity(product.reservedQuantity),
        formatQuantity(Math.max(0, availableQuantity(product)))
      )}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        grow ? styles.rowGrow : null,
        isLowStock(product) ? styles.rowLow : null,
        pressed ? styles.rowPressed : null,
      ]}>
      <View style={styles.rowMain}>
        <View style={styles.nameLine}>
          <Text style={styles.rowName} numberOfLines={2}>
            {product.name}
          </Text>
          <Text
            style={[
              styles.badge,
              isLowStock(product)
                ? styles.badgeLow
                : product.reservedQuantity > 0
                  ? styles.badgePending
                  : styles.badgeOk,
            ]}>
            {isLowStock(product)
              ? copy.lowStock
              : product.reservedQuantity > 0
                ? copy.pendingBadge
                : copy.inStockBadge}
          </Text>
        </View>
        <Text style={styles.rowUnit}>{product.unit}</Text>
        <Text style={styles.breakdown}>
          {copy.stockLine(
            formatQuantity(product.quantity),
            formatQuantity(product.reservedQuantity),
            formatQuantity(Math.max(0, availableQuantity(product)))
          )}
        </Text>
      </View>
      <View style={styles.rowQuantity}>
        <Text style={styles.rowQuantityValue}>
          {formatQuantity(Math.max(0, availableQuantity(product)))}
        </Text>
        <Text style={styles.availableLabel}>{copy.availableStock}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
  },
  header: {
    width: '100%',
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
  count: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.text,
  },
  filterLabelSelected: {
    color: colors.onPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  rowGrow: {
    flex: 1,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowLow: {
    borderColor: colors.pending,
    backgroundColor: colors.pendingSurface,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeLow: {
    backgroundColor: colors.pendingSurface,
    color: colors.pending,
  },
  badgePending: {
    backgroundColor: colors.infoSurface,
    color: colors.info,
  },
  badgeOk: {
    backgroundColor: colors.successSurface,
    color: colors.success,
  },
  breakdown: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  availableLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  rowName: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
  },
  rowUnit: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  rowQuantity: {
    minWidth: 76,
    alignItems: 'flex-end',
  },
  rowQuantityValue: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
  },
});
