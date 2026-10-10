import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { Notice } from '@/components/notice';
import { OrderForm } from '@/components/order-form';
import { Screen } from '@/components/screen';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { formatRelativeDateTime } from '@/lib/datetime';
import { formatPrice, orderTotal } from '@/lib/orders';
import { formatQuantity } from '@/lib/quantity';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();
  const { products, getOrder, saveDraftOrder, deleteDraftOrder, approveDelivery } = useInventory();
  const order = getOrder(id);
  const [saving, setSaving] = useState(false);
  const [delivering, setDelivering] = useState(false);

  if (!order) {
    return (
      <Screen width="form" style={{ padding: gutter, gap: spacing.lg }}>
        <Notice title={copy.orderMissing} message={copy.orderMissing} />
        <AppButton label={copy.orders} onPress={() => router.replace('/orders')} />
      </Screen>
    );
  }

  if (order.status === 'APPROVED_DELIVERED') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            paddingBottom: gutter + insets.bottom,
            gap: spacing.md,
          }}>
          <Notice tone="info" title={copy.approvedDelivered} message={copy.readOnlyDelivered} />
          <View style={styles.card}>
            <Text style={styles.customer}>{order.customerName}</Text>
            <Text style={styles.meta}>{copy.createdAt(formatRelativeDateTime(order.createdAt))}</Text>
            {order.deliveredAt ? (
              <Text style={styles.meta}>{copy.deliveredAt(formatRelativeDateTime(order.deliveredAt))}</Text>
            ) : null}
          </View>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.card}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.meta}>
                {copy.quantity}: {formatQuantity(item.quantity)}
              </Text>
              <Text style={styles.meta}>
                {copy.price}: {formatPrice(item.price)}
              </Text>
            </View>
          ))}
          <Text style={styles.total}>
            {copy.orderTotal}: {formatPrice(orderTotal(order.items))}
          </Text>
        </ScrollView>
      </Screen>
    );
  }

  const onDeliver = () => {
    Alert.alert(copy.deliverConfirmTitle, copy.deliverConfirmBody, [
      { text: copy.keepDraft, style: 'cancel' },
      {
        text: copy.confirm,
        onPress: () => {
          setDelivering(true);
          void approveDelivery(order.orderId)
            .then(() => {
              Alert.alert(copy.deliveredTitle, copy.deliveredBody);
            })
            .catch((error: unknown) => {
              Alert.alert(
                copy.deliveryFailed,
                error instanceof Error ? error.message : copy.deliveryFailed
              );
            })
            .finally(() => setDelivering(false));
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert(copy.deleteDraftTitle, copy.deleteDraftBody, [
      { text: copy.keepDraft, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: () => {
          void deleteDraftOrder(order.orderId)
            .then(() => {
              if (router.canGoBack()) router.back();
              else router.replace('/orders');
            })
            .catch((error: unknown) => {
              Alert.alert(copy.orderNotSaved, error instanceof Error ? error.message : copy.orderNotSaved);
            });
        },
      },
    ]);
  };

  return (
    <Screen width="form">
      <OrderForm
        products={products}
        initialCustomer={order.customerName}
        initialItems={order.items}
        saving={saving}
        submitLabel={copy.saveDraft}
        onSubmit={async (input) => {
          setSaving(true);
          try {
            await saveDraftOrder(input, order.orderId);
            Alert.alert(copy.orderSaved);
          } finally {
            setSaving(false);
          }
        }}
        footer={
          <View style={styles.actions}>
            <AppButton
              label={delivering ? copy.delivering : copy.confirmDelivery}
              onPress={onDeliver}
              disabled={delivering || saving}
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  customer: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  itemName: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  meta: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  total: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  actions: {
    gap: spacing.md,
  },
});
