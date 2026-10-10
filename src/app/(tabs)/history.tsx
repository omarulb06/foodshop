import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { HistoryEntryRow } from '@/components/history-entry-row';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useResponsive } from '@/hooks/use-responsive';
import { copy } from '@/lib/copy';
import { formatRelativeDateTime } from '@/lib/datetime';
import { countEntriesPerBatch, groupIntoBatches } from '@/lib/history';
import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, spacing } from '@/theme';
import type { HistoryEntry } from '@/types';

export default function HistoryScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { products, history } = useInventory();
  const { gutter } = useResponsive();
  const [selected, setSelected] = useState<string | null>(productId ?? null);

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products]
  );

  // Counted before filtering so a batch header can say how much of the
  // original save is being shown.
  const batchTotals = useMemo(() => countEntriesPerBatch(history), [history]);

  const sections = useMemo(() => {
    const entries = selected ? history.filter((entry) => entry.productId === selected) : history;
    return groupIntoBatches(entries).map((batch) => ({
      batchId: batch.batchId,
      savedAt: batch.savedAt,
      actor: batch.actor,
      total: batchTotals.get(batch.batchId) ?? batch.entries.length,
      data: batch.entries,
    }));
  }, [history, selected, batchTotals]);

  const selectedName = selected ? productNames.get(selected) : undefined;

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(entry: HistoryEntry) => entry.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: gutter, gap: spacing.md }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.intro}>{copy.historyIntro}</Text>
            <AppButton
              label={copy.openCharts}
              variant="secondary"
              onPress={() => router.push('/charts')}
            />
            {products.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                <Chip
                  label={copy.allProducts}
                  selected={selected === null}
                  onPress={() => setSelected(null)}
                />
                {products.map((product) => (
                  <Chip
                    key={product.id}
                    label={product.name}
                    selected={selected === product.id}
                    onPress={() => setSelected(product.id)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Notice
            title={selected ? copy.noRecordsForProduct : copy.noRecordsTitle}
            message={
              selected
                ? copy.noRecordsForName(selectedName ?? copy.unknownProduct)
                : copy.noRecordsBody
            }
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{formatRelativeDateTime(section.savedAt)}</Text>
            <Text style={styles.sectionMeta}>
              {copy.savedByActor(
                section.actor,
                section.data.length === section.total
                  ? copy.changeCount(section.total)
                  : copy.partialBatch(section.data.length, section.total)
              )}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.entry}>
            <HistoryEntryRow
              entry={item}
              productName={productNames.get(item.productId) ?? item.productName}
            />
          </View>
        )}
      />
    </Screen>
  );
}

function Chip({
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
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        pressed ? styles.chipPressed : null,
      ]}>
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  intro: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    minHeight: 48,
    maxWidth: 220,
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
  chipPressed: {
    opacity: 0.75,
  },
  chipLabel: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.onPrimary,
  },
  sectionHeader: {
    gap: 2,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  entry: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
});
