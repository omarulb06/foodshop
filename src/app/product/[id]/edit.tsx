import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { UnitPicker } from '@/components/unit-picker';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { formatQuantity, parseQuantity } from '@/lib/quantity';
import { findUnitOption, unitAllowsDecimals } from '@/lib/units';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, spacing } from '@/theme';
import type { UnitId } from '@/types';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { getProduct, editProduct } = useInventory();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();

  const product = getProduct(id);

  const [name, setName] = useState(product?.name ?? '');
  const [unitId, setUnitId] = useState<UnitId>(product?.unitId ?? 'pieces');
  const [customUnit, setCustomUnit] = useState(
    product?.unitId === 'custom' ? product.unit : ''
  );
  const [minStock, setMinStock] = useState(
    product ? formatQuantity(product.minStockLimit) : copy.lowStockDefault
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dirty = product
    ? name.trim() !== product.name ||
      unitId !== product.unitId ||
      (unitId === 'custom' && customUnit.trim() !== product.unit) ||
      minStock.trim() !== formatQuantity(product.minStockLimit)
    : false;

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert(copy.leaveTitle, copy.leaveEdits, [
      { text: copy.keepEditing, style: 'cancel' },
      {
        text: copy.discard,
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  if (!product) {
    return (
      <Screen
        width="form"
        style={{ padding: gutter, paddingBottom: gutter + insets.bottom, gap: spacing.lg }}>
        <Notice title={copy.productGoneTitle} message={copy.productGoneBody} />
        <AppButton label={copy.backToStock} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const onSubmit = async () => {
    const unit = unitId === 'custom' ? customUnit.trim() : findUnitOption(unitId).unit;
    const parsedLimit = parseQuantity(minStock, { allowDecimals: unitAllowsDecimals(unitId) });
    const nextErrors: Record<string, string | null> = {
      name: name.trim().length === 0 ? copy.nameRequired : null,
      unit: unitId === 'custom' && unit.length === 0 ? copy.unitRequired : null,
      minStock: parsedLimit.ok ? null : parsedLimit.error,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !parsedLimit.ok) return;

    setSaving(true);
    try {
      await editProduct(product.id, { name, unit, unitId, minStockLimit: parsedLimit.value });
      setLeaving(true);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (error) {
      Alert.alert(
        copy.changesNotSaved,
        error instanceof Error ? error.message : copy.productNotUpdated
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen width="form">
      <ScrollView
        contentContainerStyle={{
          padding: gutter,
          paddingBottom: gutter + insets.bottom,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          {copy.editIntro(formatQuantity(product.quantity), product.unit)}
        </Text>
        <Text style={styles.intro}>
          {copy.sku}: {product.id}
        </Text>

        <FormField
          label={copy.productName}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (errors.name) setErrors((current) => ({ ...current, name: null }));
          }}
          autoCapitalize="sentences"
          maxLength={80}
          error={errors.name}
        />

        <UnitPicker
          unitId={unitId}
          customUnit={customUnit}
          onChangeUnitId={(value) => {
            setUnitId(value);
            setErrors((current) => ({ ...current, unit: null }));
          }}
          onChangeCustomUnit={(value) => {
            setCustomUnit(value);
            if (errors.unit) setErrors((current) => ({ ...current, unit: null }));
          }}
          error={errors.unit}
        />

        <FormField
          label={copy.lowStockThreshold}
          value={minStock}
          onChangeText={(value) => {
            setMinStock(value);
            if (errors.minStock) setErrors((current) => ({ ...current, minStock: null }));
          }}
          keyboardType={unitAllowsDecimals(unitId) ? 'decimal-pad' : 'number-pad'}
          placeholder={copy.lowStockDefault}
          maxLength={10}
          error={errors.minStock}
          hint={copy.lowStockHint}
        />

        <Notice
          message={copy.unitLabelOnly}
        />

        <AppButton
          label={saving ? copy.saving : copy.saveChanges}
          onPress={onSubmit}
          disabled={saving || !dirty}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
});
