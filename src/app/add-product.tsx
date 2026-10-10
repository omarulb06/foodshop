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
import { normalizeBarcode } from '@/lib/barcode';
import { copy } from '@/lib/copy';
import { parseQuantity } from '@/lib/quantity';
import { findUnitOption, unitAllowsDecimals } from '@/lib/units';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, spacing } from '@/theme';
import type { UnitId } from '@/types';

export default function AddProductScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { barcode: barcodeParam } = useLocalSearchParams<{ barcode?: string }>();
  const scannedBarcode = barcodeParam ? normalizeBarcode(barcodeParam) : null;
  const { addProduct, lastActor } = useInventory();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState<UnitId>('pieces');
  const [customUnit, setCustomUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minStock, setMinStock] = useState<string>(copy.lowStockDefault);
  const [actor, setActor] = useState(lastActor);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dirty =
    name.trim().length > 0 ||
    customUnit.trim().length > 0 ||
    quantity.trim().length > 0 ||
    minStock.trim() !== copy.lowStockDefault;

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert(copy.leaveTitle, copy.leaveNewProduct, [
      { text: copy.keepEditing, style: 'cancel' },
      {
        text: copy.discard,
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const onSubmit = async () => {
    const unit = unitId === 'custom' ? customUnit.trim() : findUnitOption(unitId).unit;
    const parsedQuantity = parseQuantity(quantity, {
      allowDecimals: unitAllowsDecimals(unitId),
    });
    const parsedLimit = parseQuantity(minStock, {
      allowDecimals: unitAllowsDecimals(unitId),
    });

    const nextErrors: Record<string, string | null> = {
      name: name.trim().length === 0 ? copy.nameRequired : null,
      unit: unitId === 'custom' && unit.length === 0 ? copy.unitRequired : null,
      quantity: parsedQuantity.ok ? null : parsedQuantity.error,
      minStock: parsedLimit.ok ? null : parsedLimit.error,
      actor: actor.trim().length === 0 ? copy.actorRequired : null,
      barcode: barcodeParam && !scannedBarcode ? copy.invalidBarcode : null,
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean) || !parsedQuantity.ok || !parsedLimit.ok) return;

    setSaving(true);
    try {
      await addProduct({
        name,
        unit,
        unitId,
        quantity: parsedQuantity.value,
        minStockLimit: parsedLimit.value,
        actor,
        ...(scannedBarcode ? { barcode: scannedBarcode } : {}),
      });
      setLeaving(true);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (error) {
      Alert.alert(
        copy.productNotAdded,
        error instanceof Error ? error.message : copy.productNotStored
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
        <Text style={styles.intro}>{copy.addIntro}</Text>
        {barcodeParam && !scannedBarcode ? (
          <Notice tone="danger" message={copy.invalidBarcode} />
        ) : null}

        {scannedBarcode ? (
          <FormField label={copy.barcodeLabel} value={scannedBarcode} editable={false} hint={copy.barcodeLocked} />
        ) : null}

        <FormField
          label={copy.productName}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (errors.name) setErrors((current) => ({ ...current, name: null }));
          }}
          placeholder={copy.namePlaceholder}
          autoCapitalize="sentences"
          maxLength={80}
          error={errors.name}
        />

        <UnitPicker
          unitId={unitId}
          customUnit={customUnit}
          onChangeUnitId={(value) => {
            setUnitId(value);
            setErrors((current) => ({ ...current, unit: null, quantity: null }));
          }}
          onChangeCustomUnit={(value) => {
            setCustomUnit(value);
            if (errors.unit) setErrors((current) => ({ ...current, unit: null }));
          }}
          error={errors.unit}
        />

        <FormField
          label={copy.quantityNow}
          value={quantity}
          onChangeText={(value) => {
            setQuantity(value);
            if (errors.quantity) setErrors((current) => ({ ...current, quantity: null }));
          }}
          keyboardType={unitAllowsDecimals(unitId) ? 'decimal-pad' : 'number-pad'}
          placeholder={unitAllowsDecimals(unitId) ? copy.exampleDecimal : copy.exampleWhole}
          maxLength={10}
          error={errors.quantity}
          hint={
            unitAllowsDecimals(unitId) ? copy.decimalHint : copy.wholeHint
          }
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

        <FormField
          label={copy.addedBy}
          value={actor}
          onChangeText={(value) => {
            setActor(value);
            if (errors.actor) setErrors((current) => ({ ...current, actor: null }));
          }}
          placeholder={copy.yourName}
          autoCapitalize="words"
          maxLength={60}
          error={errors.actor}
          hint={copy.actorHint}
        />

        <AppButton
          label={saving ? copy.adding : copy.addProduct}
          onPress={onSubmit}
          disabled={saving}
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
