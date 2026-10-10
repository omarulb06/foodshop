import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Notice } from '@/components/notice';
import { SearchField } from '@/components/search-field';
import { copy } from '@/lib/copy';
import { listenForIntakeScan } from '@/lib/intake-scan';
import { formatQuantity, parseQuantity, roundQuantity } from '@/lib/quantity';
import { unitAllowsDecimals } from '@/lib/units';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';
import type { IntakeItem, Product } from '@/types';

interface LineDraft {
  quantity: string;
  cost: string;
}

interface IntakeFormProps {
  products: Product[];
  initialSupplier?: string;
  initialItems?: IntakeItem[];
  saving: boolean;
  submitLabel: string;
  onSubmit: (input: { supplierName: string; items: IntakeItem[] }) => Promise<void>;
  footer?: ReactNode;
}

export function IntakeForm({
  products,
  initialSupplier = '',
  initialItems = [],
  saving,
  submitLabel,
  onSubmit,
  footer,
}: IntakeFormProps) {
  const router = useRouter();
  const [supplier, setSupplier] = useState(initialSupplier);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<Record<string, LineDraft>>(() => {
    const seed: Record<string, LineDraft> = {};
    for (const item of initialItems) {
      seed[item.productId] = {
        quantity: formatQuantity(item.addedQuantity),
        cost: String(item.unitCost),
      };
    }
    return seed;
  });

  useEffect(() => {
    return listenForIntakeScan((product, quantity) => {
      setLines((current) => {
        const existing = current[product.id];
        const parsed = existing?.quantity.trim()
          ? parseQuantity(existing.quantity, { allowDecimals: unitAllowsDecimals(product.unitId) })
          : null;
        const next = roundQuantity((parsed?.ok ? parsed.value : 0) + quantity);
        return {
          ...current,
          [product.id]: {
            quantity: formatQuantity(next),
            cost: existing?.cost ?? '0',
          },
        };
      });
    });
  }, []);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(search) || product.id.toLowerCase().includes(search)
    );
  }, [products, query]);

  const chosen = useMemo(() => {
    const items: IntakeItem[] = [];
    for (const product of products) {
      const line = lines[product.id];
      if (!line || line.quantity.trim().length === 0) continue;
      const parsed = parseQuantity(line.quantity, { allowDecimals: unitAllowsDecimals(product.unitId) });
      if (!parsed.ok || parsed.value <= 0) continue;
      const cost = parseQuantity(line.cost.trim() || '0', { allowDecimals: true });
      if (!cost.ok) continue;
      items.push({
        productId: product.id,
        productName: product.name,
        addedQuantity: parsed.value,
        unitCost: cost.value,
      });
    }
    return items;
  }, [lines, products]);

  const updateLine = (productId: string, patch: Partial<LineDraft>) => {
    setLines((current) => ({
      ...current,
      [productId]: {
        quantity: current[productId]?.quantity ?? '',
        cost: current[productId]?.cost ?? '0',
        ...patch,
      },
    }));
  };

  const submit = async () => {
    if (chosen.length === 0) {
      Alert.alert(copy.intakeNotSaved, copy.intakeNeedsItems);
      return;
    }
    try {
      await onSubmit({ supplierName: supplier, items: chosen });
    } catch (error) {
      Alert.alert(copy.intakeNotSaved, error instanceof Error ? error.message : copy.intakeNotSaved);
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
          <Notice message={copy.intakeHint} />
          <FormField
            label={copy.supplierName}
            value={supplier}
            onChangeText={setSupplier}
            placeholder={copy.supplierPlaceholder}
            autoCapitalize="words"
            maxLength={80}
            hint={copy.supplierOptional}
          />
          <AppButton
            label={copy.scanForIntake}
            variant="secondary"
            onPress={() => router.push({ pathname: '/scan', params: { purpose: 'intake' } })}
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
          message={products.length === 0 ? copy.emptyShopBody : copy.noSearchBody(query.trim())}
        />
      }
      renderItem={({ item }) => {
        const line = lines[item.id];
        const parsed = line?.quantity.trim()
          ? parseQuantity(line.quantity, { allowDecimals: unitAllowsDecimals(item.unitId) })
          : null;
        return (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {copy.inStock(formatQuantity(item.quantity), item.unit)}
            </Text>
            <FormField
              label={copy.quantityAdded}
              value={line?.quantity ?? ''}
              onChangeText={(value) => updateLine(item.id, { quantity: value })}
              keyboardType={unitAllowsDecimals(item.unitId) ? 'decimal-pad' : 'number-pad'}
              placeholder={unitAllowsDecimals(item.unitId) ? copy.exampleDecimal : copy.exampleWhole}
              error={parsed && !parsed.ok ? parsed.error : null}
            />
            <FormField
              label={copy.unitCost}
              value={line?.cost ?? ''}
              onChangeText={(value) => updateLine(item.id, { cost: value })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        );
      }}
      ListFooterComponent={
        <View style={styles.footer}>
          <Text style={styles.total}>{copy.itemsCount(chosen.length)}</Text>
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
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  name: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'right',
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  total: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
});
