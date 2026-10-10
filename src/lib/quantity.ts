import { copy } from '@/lib/copy';

export const MAX_QUANTITY = 1_000_000;

/** Stored quantities are rounded to this many decimals to keep totals exact. */
export const QUANTITY_DECIMALS = 3;

export type ParsedQuantity = { ok: true; value: number } | { ok: false; error: string };

/** Removes floating point drift introduced by repeated addition and subtraction. */
export function roundQuantity(value: number): number {
  const factor = 10 ** QUANTITY_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function parseQuantity(input: string, options: { allowDecimals: boolean }): ParsedQuantity {
  const normalized = input.trim().replace(',', '.');

  if (normalized.length === 0) {
    return { ok: false, error: copy.quantityRequired };
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: copy.digitsOnly };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, error: copy.quantityInvalid };
  }
  if (!options.allowDecimals && !Number.isInteger(value)) {
    return { ok: false, error: copy.wholeNumbers };
  }
  if (value > MAX_QUANTITY) {
    return { ok: false, error: copy.quantityMax(MAX_QUANTITY) };
  }

  return { ok: true, value: roundQuantity(value) };
}

export function formatQuantity(value: number): string {
  const rounded = roundQuantity(value);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatQuantityWithUnit(value: number, unit: string): string {
  return `${formatQuantity(value)} ${unit}`.trim();
}

export function formatDelta(delta: number): string {
  const rounded = roundQuantity(delta);
  if (rounded > 0) {
    return `+${formatQuantity(rounded)}`;
  }
  if (rounded < 0) {
    return `-${formatQuantity(Math.abs(rounded))}`;
  }
  return '0';
}

/** Resulting quantity after applying one edit, clamped to the allowed range. */
export function applyChange(
  current: number,
  mode: 'add' | 'remove' | 'set',
  amount: number
): number {
  if (mode === 'set') {
    return roundQuantity(amount);
  }
  const next = mode === 'add' ? current + amount : current - amount;
  return roundQuantity(Math.min(Math.max(next, 0), MAX_QUANTITY));
}
