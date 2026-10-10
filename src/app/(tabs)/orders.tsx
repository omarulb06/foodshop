import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { SyncBanner } from '@/components/sync-banner';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { formatRelativeDateTime } from '@/lib/datetime';
import { formatPrice, orderTotal } from '@/lib/orders';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';
import type { Order, OrderStatus } from '@/types';

type Filter = 'all' | OrderStatus;

export default function OrdersScreen() {
  const router = useRouter();
  const { orders } = useInventory();
  const { gutter } = useResponsive();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter]
  );

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(order) => order.orderId}
        contentContainerStyle={[styles.list, { padding: gutter, gap: spacing.md }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <SyncBanner />
            <AppButton label={copy.newOrderButton} onPress={() => router.push('/order/new')} />
            <View style={styles.filters}>
              <FilterChip label={copy.allOrders} selected={filter === 'all'} onPress={() => setFilter('all')} />
              <FilterChip label={copy.draft} selected={filter === 'DRAFT'} onPress={() => setFilter('DRAFT')} />
              <FilterChip
                label={copy.approvedDelivered}
                selected={filter === 'APPROVED_DELIVERED'}
                onPress={() => setFilter('APPROVED_DELIVERED')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Notice
            title={orders.length === 0 ? copy.emptyOrdersTitle : copy.noOrdersFilter}
            message={orders.length === 0 ? copy.emptyOrdersBody : copy.noOrdersFilter}
          />
        }
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => router.push({ pathname: '/order/[id]', params: { id: item.orderId } })} />
        )}
      />
    </Screen>
  );
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const delivered = order.status === 'APPROVED_DELIVERED';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
      <View style={styles.cardTop}>
        <Text style={styles.customer} numberOfLines={2}>
          {order.customerName}
        </Text>
        <View style={[styles.badge, delivered ? styles.badgeDone : styles.badgeDraft]}>
          <Text style={[styles.badgeLabel, delivered ? styles.badgeLabelDone : styles.badgeLabelDraft]}>
            {copy.statusLabel(order.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>{copy.itemsCount(order.items.length)}</Text>
      <Text style={styles.meta}>{formatPrice(orderTotal(order.items))}</Text>
      <Text style={styles.meta}>{formatRelativeDateTime(order.deliveredAt ?? order.createdAt)}</Text>
    </Pressable>
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
      style={[styles.chip, selected ? styles.chipSelected : null]}>
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipLabel: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.onPrimary,
  },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  cardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  customer: {
    flex: 1,
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeDraft: {
    backgroundColor: colors.infoSurface,
  },
  badgeDone: {
    backgroundColor: colors.successSurface,
  },
  badgeLabel: {
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  badgeLabelDraft: {
    color: colors.info,
  },
  badgeLabelDone: {
    color: colors.success,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
