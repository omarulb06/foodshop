import { copy } from '@/lib/copy';
import type { ChangeKind, HistoryEntry, StockChangeType } from '@/types';

export function changeKindLabel(kind: ChangeKind, changeType?: StockChangeType): string {
  if (changeType === 'ORDER_DELIVERED') return copy.kindDelivered;
  if (changeType === 'SUPPLIER_DELIVERY') return copy.kindIntake;
  switch (kind) {
    case 'create':
      return copy.kindCreate;
    case 'add':
      return copy.kindAdd;
    case 'remove':
      return copy.kindRemove;
    case 'set':
      return copy.kindSet;
  }
}

export interface HistoryBatch {
  batchId: string;
  savedAt: string;
  actor: string;
  entries: HistoryEntry[];
}

/** One batch per "Save all changes" action. Expects entries sorted newest first. */
export function groupIntoBatches(entries: HistoryEntry[]): HistoryBatch[] {
  const batches: HistoryBatch[] = [];
  const index = new Map<string, HistoryBatch>();

  for (const entry of entries) {
    const existing = index.get(entry.batchId);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    const batch: HistoryBatch = {
      batchId: entry.batchId,
      savedAt: entry.savedAt,
      actor: entry.actor,
      entries: [entry],
    };
    index.set(entry.batchId, batch);
    batches.push(batch);
  }

  return batches;
}

export function countEntriesPerBatch(history: HistoryEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of history) {
    counts.set(entry.batchId, (counts.get(entry.batchId) ?? 0) + 1);
  }
  return counts;
}
