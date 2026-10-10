import { createId } from '@/lib/ids';
import { emptyInventory } from '@/lib/inventory-store';
import { findUnitOption } from '@/lib/units';
import type { HistoryEntry, InventoryData, Product, UnitId } from '@/types';

export const SAMPLE_ACTOR = 'נתוני דוגמה';

const SAMPLE_PRODUCTS: { name: string; unitId: UnitId; quantity: number }[] = [
  { name: 'עגבניות משומרות', unitId: 'pieces', quantity: 48 },
  { name: 'פולי קפה', unitId: 'packs', quantity: 10 },
  { name: 'ביצים', unitId: 'pieces', quantity: 60 },
  { name: 'חלב 1 ל׳', unitId: 'bottles', quantity: 24 },
  { name: 'שמן זית 1 ל׳', unitId: 'bottles', quantity: 15 },
  { name: 'תפוחי אדמה', unitId: 'kg', quantity: 42.5 },
  { name: 'אורז 5 ק״ג', unitId: 'packs', quantity: 8 },
  { name: 'סוכר', unitId: 'kg', quantity: 18 },
  { name: 'קמח', unitId: 'kg', quantity: 30 },
];

/**
 * Written once, the first time the app runs on a device. Delete the products in
 * the app if you would rather start from an empty shop.
 */
export function createSampleInventory(now: Date = new Date()): InventoryData {
  const savedAt = now.toISOString();
  const batchId = createId('batch');

  const products: Product[] = [];
  const history: HistoryEntry[] = [];

  for (const sample of SAMPLE_PRODUCTS) {
    const unit = findUnitOption(sample.unitId).unit;
    const product: Product = {
      id: createId('product'),
      name: sample.name,
      unit,
      unitId: sample.unitId,
      quantity: sample.quantity,
      reservedQuantity: 0,
      minStockLimit: 5,
      createdAt: savedAt,
      updatedAt: savedAt,
    };
    products.push(product);

    history.push({
      id: createId('entry'),
      batchId,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      kind: 'create',
      changeType: 'MANUAL_ADJUST',
      quantityBefore: 0,
      quantityAfter: product.quantity,
      delta: product.quantity,
      note: 'מוצר לדוגמה שנוסף בהפעלה הראשונה',
      actor: SAMPLE_ACTOR,
      savedAt,
    });
  }

  return { ...emptyInventory(), products, history };
}
