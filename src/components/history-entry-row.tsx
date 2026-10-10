import { StyleSheet, Text, View } from 'react-native';

import { copy } from '@/lib/copy';
import { formatRelativeDateTime } from '@/lib/datetime';
import { changeKindLabel } from '@/lib/history';
import { formatDelta, formatQuantity } from '@/lib/quantity';
import { colors, fontSize, radius, spacing } from '@/theme';
import type { HistoryEntry } from '@/types';

interface HistoryEntryRowProps {
  entry: HistoryEntry;
  /** Current product name, so a renamed product does not look like a different one. */
  productName: string;
  /** Product detail already groups by product, so the name can be hidden there. */
  showProductName?: boolean;
  /** Batch headers already show when and who, so those can be hidden there. */
  showTimestamp?: boolean;
}

export function HistoryEntryRow({
  entry,
  productName,
  showProductName = true,
  showTimestamp = false,
}: HistoryEntryRowProps) {
  const tone = entry.delta > 0 ? 'up' : entry.delta < 0 ? 'down' : 'flat';

  return (
    <View style={styles.row}>
      <View style={styles.main}>
        {showProductName ? (
          <Text style={styles.product} numberOfLines={2}>
            {productName}
          </Text>
        ) : null}
        <Text style={styles.kind}>{changeKindLabel(entry.kind, entry.changeType)}</Text>
        <Text style={styles.quantities}>
          {formatQuantity(entry.quantityBefore)} → {formatQuantity(entry.quantityAfter)}{' '}
          {entry.unit}
        </Text>
        {showTimestamp ? (
          <Text style={styles.meta}>
            {copy.savedByLine(formatRelativeDateTime(entry.savedAt), entry.actor)}
          </Text>
        ) : null}
        {entry.note ? <Text style={styles.note}>“{entry.note}”</Text> : null}
      </View>
      <View style={[styles.delta, deltaSurface[tone]]}>
        <Text style={[styles.deltaText, deltaText[tone]]}>{formatDelta(entry.delta)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  product: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  kind: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  quantities: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  note: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  delta: {
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  deltaText: {
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

const deltaSurface = {
  up: { backgroundColor: colors.successSurface },
  down: { backgroundColor: colors.dangerSurface },
  flat: { backgroundColor: colors.surfaceMuted },
} as const;

const deltaText = {
  up: { color: colors.success },
  down: { color: colors.danger },
  flat: { color: colors.textMuted },
} as const;
