import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { IntakeForm } from '@/components/intake-form';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { formatRelativeDateTime } from '@/lib/datetime';
import { formatQuantity } from '@/lib/quantity';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';

export default function IntakeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();
  const { products, getIntake, saveDraftIntake, deleteDraftIntake, receiveIntake } = useInventory();
  const intake = getIntake(id);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState(false);

  if (!intake) {
    return (
      <Screen width="form" style={{ padding: gutter, gap: spacing.lg }}>
        <Notice title={copy.intakeMissing} message={copy.intakeMissing} />
        <AppButton label={copy.supplierDeliveries} onPress={() => router.replace('/intakes')} />
      </Screen>
    );
  }

  if (intake.status === 'RECEIVED_COMPLETED') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            paddingBottom: gutter + insets.bottom,
            gap: spacing.md,
          }}>
          <Notice tone="info" title={copy.receivedCompleted} message={copy.readOnlyIntake} />
          <View style={styles.card}>
            <Text style={styles.supplier}>{intake.supplierName.trim() || copy.unnamedSupplier}</Text>
            <Text style={styles.meta}>{copy.createdAt(formatRelativeDateTime(intake.createdAt))}</Text>
            {intake.receivedAt ? (
              <Text style={styles.meta}>{copy.receivedAt(formatRelativeDateTime(intake.receivedAt))}</Text>
            ) : null}
          </View>
          {intake.items.map((item) => (
            <View key={item.productId} style={styles.card}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.meta}>
                {copy.quantityAdded}: {formatQuantity(item.addedQuantity)}
              </Text>
              <Text style={styles.meta}>
                {copy.unitCost}: {formatQuantity(item.unitCost)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  const onReceive = () => {
    Alert.alert(copy.confirmIntakeTitle, copy.confirmIntakeBody, [
      { text: copy.keepDraft, style: 'cancel' },
      {
        text: copy.confirm,
        onPress: () => {
          setReceiving(true);
          void receiveIntake(intake.deliveryId)
            .then(() => {
              Alert.alert(copy.receivedTitle, copy.receivedBody);
            })
            .catch((error: unknown) => {
              Alert.alert(copy.intakeFailed, error instanceof Error ? error.message : copy.intakeFailed);
            })
            .finally(() => setReceiving(false));
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert(copy.deleteIntakeTitle, copy.deleteIntakeBody, [
      { text: copy.keepDraft, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: () => {
          void deleteDraftIntake(intake.deliveryId)
            .then(() => {
              if (router.canGoBack()) router.back();
              else router.replace('/intakes');
            })
            .catch((error: unknown) => {
              Alert.alert(copy.intakeNotSaved, error instanceof Error ? error.message : copy.intakeNotSaved);
            });
        },
      },
    ]);
  };

  return (
    <Screen width="form">
      <IntakeForm
        products={products}
        initialSupplier={intake.supplierName}
        initialItems={intake.items}
        saving={saving}
        submitLabel={copy.saveIntake}
        onSubmit={async (input) => {
          setSaving(true);
          try {
            await saveDraftIntake(input, intake.deliveryId);
            Alert.alert(copy.intakeSaved);
          } finally {
            setSaving(false);
          }
        }}
        footer={
          <View style={styles.actions}>
            <AppButton
              label={receiving ? copy.receiving : copy.confirmIntake}
              onPress={onReceive}
              disabled={receiving || saving}
            />
            <AppButton label={copy.deleteDraft} variant="danger" onPress={onDelete} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  supplier: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  itemName: {
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
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
