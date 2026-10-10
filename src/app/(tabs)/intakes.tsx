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
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';
import type { IntakeStatus, SupplierIntake } from '@/types';

type Filter = 'all' | IntakeStatus;

export default function IntakesScreen() {
  const router = useRouter();
  const { intakes } = useInventory();
  const { gutter } = useResponsive();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? intakes : intakes.filter((intake) => intake.status === filter)),
    [intakes, filter]
  );

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(intake) => intake.deliveryId}
        contentContainerStyle={[styles.list, { padding: gutter, gap: spacing.md }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <SyncBanner />
            <AppButton label={copy.newIntake} onPress={() => router.push('/intake/new')} />
            <View style={styles.filters}>
              <FilterChip label={copy.allOrders} selected={filter === 'all'} onPress={() => setFilter('all')} />
              <FilterChip
                label={copy.intakeDraft}
                selected={filter === 'DRAFT'}
                onPress={() => setFilter('DRAFT')}
              />
              <FilterChip
                label={copy.receivedCompleted}
                selected={filter === 'RECEIVED_COMPLETED'}
                onPress={() => setFilter('RECEIVED_COMPLETED')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Notice
            title={intakes.length === 0 ? copy.emptyIntakesTitle : copy.noOrdersFilter}
            message={intakes.length === 0 ? copy.emptyIntakesBody : copy.noOrdersFilter}
          />
        }
        renderItem={({ item }) => (
          <IntakeCard
            intake={item}
            onPress={() => router.push({ pathname: '/intake/[id]', params: { id: item.deliveryId } })}
          />
        )}
      />
    </Screen>
  );
}

function IntakeCard({ intake, onPress }: { intake: SupplierIntake; onPress: () => void }) {
  const received = intake.status === 'RECEIVED_COMPLETED';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
      <View style={styles.cardTop}>
        <Text style={styles.supplier} numberOfLines={2}>
          {intake.supplierName.trim() || copy.unnamedSupplier}
        </Text>
        <View style={[styles.badge, received ? styles.badgeDone : styles.badgeDraft]}>
          <Text style={[styles.badgeLabel, received ? styles.badgeLabelDone : styles.badgeLabelDraft]}>
            {copy.intakeStatus(intake.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>{copy.itemsCount(intake.items.length)}</Text>
      <Text style={styles.meta}>{formatRelativeDateTime(intake.receivedAt ?? intake.createdAt)}</Text>
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
  supplier: {
    flex: 1,
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
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
    textAlign: 'right',
  },
});
