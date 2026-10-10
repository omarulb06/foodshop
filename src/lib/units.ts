import { copy } from '@/lib/copy';
import type { UnitId } from '@/types';

export interface UnitOption {
  id: UnitId;
  /** Text shown on the selector button. */
  label: string;
  /** Default unit label stored on the product. Empty for custom units. */
  unit: string;
  allowsDecimals: boolean;
}

export const UNIT_OPTIONS: UnitOption[] = [
  { id: 'pieces', label: copy.pieces, unit: copy.pieces, allowsDecimals: false },
  { id: 'packs', label: copy.packs, unit: copy.packs, allowsDecimals: false },
  { id: 'boxes', label: copy.boxes, unit: copy.boxes, allowsDecimals: false },
  { id: 'bottles', label: copy.bottles, unit: copy.bottles, allowsDecimals: false },
  { id: 'kg', label: copy.kilograms, unit: 'ק״ג', allowsDecimals: true },
  { id: 'custom', label: copy.customUnit, unit: '', allowsDecimals: true },
];

export function findUnitOption(unitId: UnitId): UnitOption {
  return UNIT_OPTIONS.find((option) => option.id === unitId) ?? UNIT_OPTIONS[0];
}

/** Whole units are counted in pieces, so only weights and custom units take decimals. */
export function unitAllowsDecimals(unitId: UnitId): boolean {
  return findUnitOption(unitId).allowsDecimals;
}

export const MAX_UNIT_LENGTH = 16;
