import { countEntriesPerBatch, groupIntoBatches } from '@/lib/history';
import type { HistoryEntry } from '@/types';

function entry(id: string, batchId: string, actor = 'Sam'): HistoryEntry {
  return {
    id,
    batchId,
    productId: `product-${id}`,
    productName: `Product ${id}`,
    unit: 'pieces',
    kind: 'add',
    changeType: 'MANUAL_ADJUST',
    quantityBefore: 0,
    quantityAfter: 1,
    delta: 1,
    actor,
    savedAt: '2026-10-08T10:00:00.000Z',
  };
}

describe('groupIntoBatches', () => {
  it('keeps every record saved together in one batch', () => {
    const batches = groupIntoBatches([
      entry('a', 'batch-2'),
      entry('b', 'batch-1'),
      entry('c', 'batch-1'),
    ]);

    expect(batches).toHaveLength(2);
    expect(batches[0].batchId).toBe('batch-2');
    expect(batches[1].entries.map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('preserves the order the records arrive in', () => {
    const batches = groupIntoBatches([entry('a', 'batch-1'), entry('b', 'batch-2')]);
    expect(batches.map((batch) => batch.batchId)).toEqual(['batch-1', 'batch-2']);
  });

  it('returns nothing for an empty history', () => {
    expect(groupIntoBatches([])).toEqual([]);
  });
});

describe('countEntriesPerBatch', () => {
  it('counts the full size of each batch', () => {
    const counts = countEntriesPerBatch([
      entry('a', 'batch-1'),
      entry('b', 'batch-1'),
      entry('c', 'batch-2'),
    ]);

    expect(counts.get('batch-1')).toBe(2);
    expect(counts.get('batch-2')).toBe(1);
  });
});
