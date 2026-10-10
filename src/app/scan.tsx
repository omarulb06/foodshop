import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { FormField } from '@/components/form-field';
import { normalizeBarcode } from '@/lib/barcode';
import { completeIntakeScan } from '@/lib/intake-scan';
import { copy } from '@/lib/copy';
import { availableQuantity } from '@/lib/stock';
import { formatQuantity, parseQuantity } from '@/lib/quantity';
import { unitAllowsDecimals } from '@/lib/units';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, spacing } from '@/theme';
import type { Product } from '@/types';

type Phase =
  | { kind: 'scanning' }
  | { kind: 'loading'; barcode: string }
  | { kind: 'found'; barcode: string; product: Product }
  | { kind: 'missing'; barcode: string };

async function confirmScan() {
  try {
    await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
  } catch {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // A device without a vibrator should still complete the scan.
    }
  }
}

export default function ScanScreen() {
  const router = useRouter();
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const receiving = purpose === 'intake';
  const insets = useSafeAreaInsets();
  const { fetchProduct, saveStockChanges, addProductToLatestDraft, lastActor } = useInventory();
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [quantity, setQuantity] = useState('');
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resume = () => {
    setQuantity('');
    setQuantityError(null);
    setBusy(false);
    setPhase({ kind: 'scanning' });
  };

  const onScanned = (raw: string) => {
    const barcode = normalizeBarcode(raw);
    if (!barcode) return;
    void confirmScan();
    setPhase({ kind: 'loading', barcode });
    void fetchProduct(barcode).then((product) => {
      if (product) {
        setQuantity(receiving ? '1' : formatQuantity(product.quantity));
        setPhase({ kind: 'found', barcode, product });
      } else {
        setPhase({ kind: 'missing', barcode });
      }
    });
  };

  const onAddToIntake = (product: Product) => {
    const parsed = parseQuantity(quantity, { allowDecimals: unitAllowsDecimals(product.unitId) });
    if (!parsed.ok || parsed.value <= 0) {
      setQuantityError(parsed.ok ? copy.intakeNeedsItems : parsed.error);
      return;
    }
    if (!completeIntakeScan(product, parsed.value)) {
      Alert.alert(copy.intakeNotSaved, copy.intakeMissing);
      return;
    }
    router.back();
  };

  const onUpdateCount = async (product: Product) => {
    const parsed = parseQuantity(quantity, { allowDecimals: unitAllowsDecimals(product.unitId) });
    if (!parsed.ok) {
      setQuantityError(parsed.error);
      return;
    }
    if (parsed.value === product.quantity) {
      resume();
      return;
    }
    setBusy(true);
    try {
      await saveStockChanges({
        actor: lastActor.trim() || copy.scanActor,
        changes: [
          {
            productId: product.id,
            mode: 'set',
            amount: parsed.value,
            note: copy.scanNote,
          },
        ],
      });
      resume();
    } catch (error) {
      setBusy(false);
      Alert.alert(copy.nothingSaved, error instanceof Error ? error.message : copy.couldNotStore);
    }
  };

  const onAddToOrder = async (product: Product) => {
    setBusy(true);
    try {
      const order = await addProductToLatestDraft(product);
      if (!order) {
        router.push({ pathname: '/order/new', params: { productId: product.id } });
        return;
      }
      Alert.alert(copy.addedToDraft(order.customerName));
      resume();
    } catch (error) {
      setBusy(false);
      Alert.alert(
        copy.couldNotAddToOrder,
        error instanceof Error ? error.message : copy.orderNotSaved
      );
    }
  };

  const dialogOpen = phase.kind !== 'scanning';

  return (
    <View style={styles.root}>
      <BarcodeScanner enabled={!dialogOpen} onScanned={onScanned} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.backToStock}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.back, { top: insets.top + spacing.sm }]}>
        <Text style={styles.backLabel}>{copy.backToStock}</Text>
      </Pressable>

      <Modal visible={dialogOpen} transparent animationType="fade" onRequestClose={resume}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {phase.kind === 'loading' ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.sheetBody}>{copy.scanLooking}</Text>
              </>
            ) : null}

            {phase.kind === 'missing' ? (
              <>
                <Text style={styles.sheetTitle}>{copy.scanMissingTitle}</Text>
                <Text style={styles.sheetBody}>{copy.scanMissingBody}</Text>
                <Text style={styles.barcode}>{phase.barcode}</Text>
                <AppButton
                  label={copy.createLinked}
                  onPress={() =>
                    router.push({ pathname: '/add-product', params: { barcode: phase.barcode } })
                  }
                />
                <AppButton label={copy.scanAgain} variant="secondary" onPress={resume} />
              </>
            ) : null}

            {phase.kind === 'found' ? (
              <>
                <Text style={styles.sheetTitle}>{copy.scanFound}</Text>
                <Text style={styles.productName}>{phase.product.name}</Text>
                <Text style={styles.sheetBody}>
                  {copy.stockLine(
                    formatQuantity(phase.product.quantity),
                    formatQuantity(phase.product.reservedQuantity),
                    formatQuantity(Math.max(0, availableQuantity(phase.product)))
                  )}{' '}
                  {phase.product.unit}
                </Text>
                <Text style={styles.barcode}>
                  {copy.sku}: {phase.barcode}
                </Text>
                <FormField
                  label={receiving ? copy.quantityAdded : copy.quantity}
                  value={quantity}
                  onChangeText={(value) => {
                    setQuantity(value);
                    if (quantityError) setQuantityError(null);
                  }}
                  keyboardType={unitAllowsDecimals(phase.product.unitId) ? 'decimal-pad' : 'number-pad'}
                  error={quantityError}
                />
                {receiving ? (
                  <AppButton
                    label={copy.addToIntake}
                    onPress={() => onAddToIntake(phase.product)}
                    disabled={busy}
                  />
                ) : (
                  <>
                    <AppButton
                      label={copy.updateCount}
                      onPress={() => void onUpdateCount(phase.product)}
                      disabled={busy}
                    />
                    <AppButton
                      label={copy.addToOrder}
                      variant="secondary"
                      onPress={() => void onAddToOrder(phase.product)}
                      disabled={busy}
                    />
                  </>
                )}
                <AppButton label={copy.scanAgain} variant="quiet" onPress={resume} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  back: {
    position: 'absolute',
    start: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backLabel: {
    color: '#FFFFFF',
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  productName: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  sheetBody: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  barcode: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'ltr',
    textAlign: 'right',
  },
});
