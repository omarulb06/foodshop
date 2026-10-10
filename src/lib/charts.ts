import { dayKey, lastDayKeys, lastMonthKeys, monthKey } from '@/lib/datetime';
import { roundQuantity } from '@/lib/quantity';
import type { HistoryEntry } from '@/types';

export interface StockLevelPoint {
  dayKey: string;
  /** `null` until the product has history, so the line does not start at zero. */
  value: number | null;
}

export type QuantityRange = '7d' | '30d' | '6m';

/**
 * Stock level at the end of each bucket.
 * The level is the quantity left by the most recent record in or before that
 * bucket, so quiet days and months keep the previous level.
 */
export function buildBucketSeries(
  entries: HistoryEntry[],
  buckets: string[],
  bucketOf: (savedAt: string) => string
): StockLevelPoint[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );

  let index = 0;
  let level: number | null = null;

  return buckets.map((key) => {
    while (index < sorted.length && bucketOf(sorted[index].savedAt) <= key) {
      level = sorted[index].quantityAfter;
      index += 1;
    }
    return { dayKey: key, value: level };
  });
}

export function buildStockLevelSeries(
  entries: HistoryEntry[],
  days: number,
  now: string | Date = new Date()
): StockLevelPoint[] {
  return buildBucketSeries(entries, lastDayKeys(days, now), dayKey);
}

export function buildRangeSeries(
  entries: HistoryEntry[],
  range: QuantityRange,
  now: string | Date = new Date()
): StockLevelPoint[] {
  if (range === '6m') return buildBucketSeries(entries, lastMonthKeys(6, now), monthKey);
  return buildStockLevelSeries(entries, range === '7d' ? 7 : 30, now);
}

/** Adds one series per product. A product with no history yet contributes nothing. */
export function sumStockSeries(series: StockLevelPoint[][]): StockLevelPoint[] {
  if (series.length === 0) return [];
  return series[0].map((point, index) => {
    let total = 0;
    let any = false;
    for (const row of series) {
      const value = row[index]?.value;
      if (value === null || value === undefined) continue;
      any = true;
      total = roundQuantity(total + value);
    }
    return { dayKey: point.dayKey, value: any ? total : null };
  });
}
