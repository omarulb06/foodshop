import { useMemo, useState, type ReactNode } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Notice } from '@/components/notice';
import { SearchField } from '@/components/search-field';
import { copy } from '@/lib/copy';
import { formatPrice, orderTotal } from '@/lib/orders';
import { formatQuantity, parseQuantity, roundQuantity } from '@/lib/quantity';
import { availableQuantity } from '@/lib/stock';
import { unitAllowsDecimals } from '@/lib/units';
import { colors, fontSize, radius, spacing } from '@/theme';
import type { OrderItem, Product } from '@/types';

interface LineDraft {
  quantity: string;
  price: string;
}

interface OrderFormProps {
  products: Product[];
  initialCustomer?: string;
  initialItems?: OrderItem[];
  saving: boolean;
  submitLabel: string;
  onSubmit: (input: { customerName: string; items: OrderItem[] }) => Promise<void>;
  footer?: ReactNode;
}

export function OrderForm({
  products,
  initialCustomer = '',
  initialItems = [],
  saving,
  submitLabel,
  onSubmit,
  footer,
}: OrderFormProps) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<Record<string, LineDraft>>(() => {
    const seed: Record<string, LineDraft> = {};
    for (const item of initialItems) {
      seed[item.productId] = {
        quantity: formatQuantity(item.quantity),
        price: String(item.price),
      };
    }
    return seed;
  });

  const held = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of initialItems) {
      totals.set(item.productId, roundQuantity((totals.get(item.productId) ?? 0) + item.quantity));
    }
    return totals;
  }, [initialItems]);

  const capacityFor = (product: Product) =>
    roundQuantity(product.quantity - product.reservedQuantity + (held.get(product.id) ?? 0));

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(search) || product.id.toLowerCase().includes(search)
    );
  }, [products, query]);

  const chosen = useMemo(() => {
    const items: OrderItem[] = [];
    for (const product of products) {
      const line = lines[product.id];
      if (!line || line.quantity.trim().length === 0) continue;
      const parsed = parseQuantity(line.quantity, {
        allowDecimals: unitAllowsDecimals(product.unitId),
      });
      if (!parsed.ok || parsed.value <= 0) continue;
      const price = parseQuantity(line.price.trim() || '0', { allowDecimals: true });
      if (!price.ok) continue;
      items.push({
        productId: product.id,
        productName: product.name,
        quantity: parsed.value,
        price: price.value,
      });
    }
    return items;
  }, [lines, products]);

  const updateLine = (productId: string, patch: Partial<LineDraft>) => {
    setLines((current) => ({
      ...current,
      [productId]: {
        quantity: current[productId]?.quantity ?? '',
        price: current[productId]?.price ?? '0',
        ...patch,
      },
    }));
  };

  const submit = async () => {
    if (customer.trim().length === 0) {
      setCustomerError(copy.customerRequired);
      return;
    }
    if (chosen.length === 0) {
      Alert.alert(copy.orderNotSaved, copy.orderNeedsItems);
      return;
    }
    const overflow = chosen.find((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return product ? item.quantity > capacityFor(product) : true;
    });
    if (overflow) {
      const product = products.find((candidate) => candidate.id === overflow.productId);
      Alert.alert(
        copy.orderNotSaved,
        copy.notEnoughAvailable(
          overflow.productName,
          formatQuantity(product ? Math.max(0, capacityFor(product)) : 0),
          formatQuantity(overflow.quantity)
        )
      );
      return;
    }
    try {
      await onSubmit({ customerName: customer, items: chosen });
    } catch (error) {
      Alert.alert(copy.orderNotSaved, error instanceof Error ? error.message : copy.orderNotSaved);
    }
  };

  return (
    <FlatList
      data={visible}
      keyExtractor={(product) => product.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Notice message={copy.draftHint} />
          <FormField
            label={copy.customerName}
            value={customer}
            onChangeText={(value) => {
              setCustomer(value);
              if (customerError) setCustomerError(null);
            }}
            placeholder={copy.customerPlaceholder}
            autoCapitalize="words"
            maxLength={80}
            error={customerError}
          />
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={copy.searchProducts}
            accessibilityLabel={copy.searchProducts}
          />
        </View>
      }
      ListEmptyComponent={
        <Notice
          title={products.length === 0 ? copy.emptyShopTitle : copy.noSearchTitle}
          message={
            products.length === 0 ? copy.emptyShopBody : copy.noSearchBody(query.trim())
          }
        />
      }
      renderItem={({ item }) => {
        const line = lines[item.id];
        const parsed = line?.quantity.trim()
          ? parseQuantity(line.quantity, { allowDecimals: unitAllowsDecimals(item.unitId) })
          : null;
        const capacity = capacityFor(item);
        const over = parsed?.ok === true && parsed.value > capacity ? copy.overStock : null;
        return (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {copy.stockLine(
                formatQuantity(item.quantity),
                formatQuantity(Math.max(0, item.reservedQuantity - (held.get(item.id) ?? 0))),
                formatQuantity(Math.max(0, capacity))
              )}{' '}
              {item.unit}
            </Text>
            <Text style={styles.meta}>
              {copy.availableStock}: {formatQuantity(Math.max(0, availableQuantity(item)))} {item.unit}
            </Text>
            <FormField
              label={copy.quantity}
              value={line?.quantity ?? ''}
              onChangeText={(value) => updateLine(item.id, { quantity: value })}
              keyboardType={unitAllowsDecimals(item.unitId) ? 'decimal-pad' : 'number-pad'}
              placeholder={unitAllowsDecimals(item.unitId) ? copy.exampleDecimal : copy.exampleWhole}
              error={parsed && !parsed.ok ? parsed.error : null}
            />
            <FormField
              label={copy.price}
              value={line?.price ?? ''}
              onChangeText={(value) => updateLine(item.id, { price: value })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            {over ? <Text style={styles.warning}>{over}</Text> : null}
          </View>
        );
      }}
      ListFooterComponent={
        <View style={styles.footer}>
          <Text style={styles.total}>
            {copy.orderTotal}: {formatPrice(orderTotal(chosen))}
          </Text>
          <Text style={styles.meta}>{copy.itemsCount(chosen.length)}</Text>
          <AppButton label={saving ? copy.saving : submitLabel} onPress={() => void submit()} disabled={saving} />
          {footer}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  name: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  warning: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.pending,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  total: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
