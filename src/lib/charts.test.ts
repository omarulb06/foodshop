import { buildRangeSeries, buildStockLevelSeries, sumStockSeries } from '@/lib/charts';
import type { HistoryEntry } from '@/types';

function entry(savedAt: string, quantityAfter: number, batchId = 'batch-1'): HistoryEntry {
  return {
    id: `entry-${savedAt}-${quantityAfter}`,
    batchId,
    productId: 'product-1',
    productName: 'תפוחי אדמה',
    unit: 'ק״ג',
    kind: 'set',
    changeType: 'MANUAL_ADJUST',
    quantityBefore: 0,
    quantityAfter,
    delta: quantityAfter,
    actor: 'Sam',
    savedAt,
  };
}

/** Local midday timestamps keep the test independent of the machine time zone. */
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

describe('buildStockLevelSeries', () => {
  const now = new Date(2026, 9, 8, 15);

  it('leaves days before the first record empty', () => {
    const series = buildStockLevelSeries([entry(localIso(2026, 10, 7), 20)], 7, now);
    expect(series[0].value).toBeNull();
    expect(series.at(-2)?.value).toBe(20);
  });

  it('carries the last known level through days without records', () => {
    const series = buildStockLevelSeries([entry(localIso(2026, 10, 4), 12)], 7, now);
    expect(series.at(-1)?.value).toBe(12);
  });

  it('uses the final record of a day when several were saved', () => {
    const series = buildStockLevelSeries(
      [entry(localIso(2026, 10, 8, 8), 30), entry(localIso(2026, 10, 8, 17), 25)],
      7,
      now
    );
    expect(series.at(-1)?.value).toBe(25);
  });

  it('starts from a level set before the window', () => {
    const series = buildStockLevelSeries([entry(localIso(2026, 8, 1), 99)], 7, now);
    expect(series.every((point) => point.value === 99)).toBe(true);
  });

  it('returns only empty days when there is no history', () => {
    const series = buildStockLevelSeries([], 30, now);
    expect(series).toHaveLength(30);
    expect(series.every((point) => point.value === null)).toBe(true);
  });
});

describe('buildRangeSeries', () => {
  const now = new Date(2026, 9, 8, 15);

  it('returns one point per month for the monthly view', () => {
    const series = buildRangeSeries([entry(localIso(2026, 8, 2), 4), entry(localIso(2026, 10, 3), 9)], '6m', now);
    expect(series).toHaveLength(6);
    expect(series[0].dayKey).toBe('2026-05');
    expect(series.at(-1)?.dayKey).toBe('2026-10');
    expect(series.find((point) => point.dayKey === '2026-08')?.value).toBe(4);
    expect(series.find((point) => point.dayKey === '2026-09')?.value).toBe(4);
    expect(series.at(-1)?.value).toBe(9);
  });
});

describe('sumStockSeries', () => {
  it('adds the known level of each product and skips days a product did not exist', () => {
    const total = sumStockSeries([
      [
        { dayKey: '2026-10-01', value: null },
        { dayKey: '2026-10-02', value: 2 },
      ],
      [
        { dayKey: '2026-10-01', value: 5 },
        { dayKey: '2026-10-02', value: 1 },
      ],
    ]);
    expect(total).toEqual([
      { dayKey: '2026-10-01', value: 5 },
      { dayKey: '2026-10-02', value: 3 },
    ]);
  });
});
