import { doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';

import { historyToFirestore, intakeToFirestore, productToFirestore } from '@/data/firestore-mappers';
import { copy } from '@/lib/copy';
import { InventoryError } from '@/lib/errors';
import { addedByProduct, type IntakeApply, type IntakeLine } from '@/lib/intake';
import { createId } from '@/lib/ids';
import { MAX_QUANTITY, roundQuantity } from '@/lib/quantity';
import { DEFAULT_MIN_STOCK } from '@/lib/stock';
import type { HistoryEntry, IntakeItem, Product, SupplierIntake } from '@/types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Reads the shipment and every product, then writes the new stock, the received
 * shipment and the history rows in one transaction. All reads happen before writes.
 */
export async function runIntakeTransaction(
  db: Firestore,
  deliveryId: string,
  actor: string,
  now: string
): Promise<IntakeApply> {
  const intakeRef = doc(db, 'deliveries', deliveryId);

  return runTransaction(db, async (transaction) => {
    const intakeSnap = await transaction.get(intakeRef);
    if (!intakeSnap.exists()) throw new InventoryError(copy.intakeMissing);

    const intakeRaw = asRecord(intakeSnap.data());
    if (intakeRaw.status !== 'DRAFT') throw new InventoryError(copy.intakeAlreadyReceived);

    const items = Array.isArray(intakeRaw.items) ? intakeRaw.items : [];
    const parsedItems: IntakeItem[] = items.map((item) => {
      const record = asRecord(item);
      return {
        productId: typeof record.productId === 'string' ? record.productId : '',
        productName: typeof record.productName === 'string' ? record.productName : '',
        addedQuantity: typeof record.addedQuantity === 'number' ? record.addedQuantity : 0,
        unitCost: typeof record.unitCost === 'number' ? record.unitCost : 0,
      };
    });
    const needed = addedByProduct(parsedItems.filter((item) => item.productId && item.addedQuantity > 0));
    if (needed.size === 0) throw new InventoryError(copy.intakeNeedsItems);

    const productRefs = [...needed.keys()].map((productId) => doc(db, 'products', productId));
    const productSnaps = [];
    for (const productRef of productRefs) {
      productSnaps.push(await transaction.get(productRef));
    }

    const lines: IntakeLine[] = [];
    const history: HistoryEntry[] = [];
    const updatedProducts: Product[] = [];
    const batchId = createId('batch');
    const supplierName = typeof intakeRaw.supplierName === 'string' ? intakeRaw.supplierName : '';

    for (let index = 0; index < productSnaps.length; index += 1) {
      const snap = productSnaps[index];
      const productId = productRefs[index].id;
      const request = needed.get(productId);
      if (!request) continue;
      if (!snap.exists()) throw new InventoryError(copy.productMissing(request.name || productId));

      const data = asRecord(snap.data());
      const before = typeof data.quantity === 'number' && Number.isFinite(data.quantity) ? data.quantity : 0;
      const after = roundQuantity(before + request.quantity);
      if (after > MAX_QUANTITY) throw new InventoryError(copy.quantityMax(MAX_QUANTITY));

      const reservedQuantity =
        typeof data.reservedQuantity === 'number' && Number.isFinite(data.reservedQuantity)
          ? data.reservedQuantity
          : 0;
      const minStockLimit =
        typeof data.minStockLimit === 'number' && Number.isFinite(data.minStockLimit)
          ? Math.max(0, data.minStockLimit)
          : DEFAULT_MIN_STOCK;
      const name = typeof data.name === 'string' && data.name ? data.name : request.name;
      const unit = typeof data.unit === 'string' ? data.unit : '';
      const createdAt =
        data.createdAt && typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (data.createdAt as { toDate: () => Date }).toDate().toISOString()
          : now;

      const product: Product = {
        id: productId,
        name,
        unit,
        unitId:
          data.unitId === 'pieces' ||
          data.unitId === 'packs' ||
          data.unitId === 'boxes' ||
          data.unitId === 'bottles' ||
          data.unitId === 'kg' ||
          data.unitId === 'custom'
            ? data.unitId
            : 'pieces',
        quantity: after,
        reservedQuantity,
        minStockLimit,
        createdAt,
        updatedAt: now,
      };
      updatedProducts.push(product);
      lines.push({
        productId,
        productName: name,
        unit,
        quantityBefore: before,
        quantityAfter: after,
        added: request.quantity,
      });
      history.push({
        id: createId('entry'),
        batchId,
        productId,
        productName: name,
        unit,
        kind: 'add',
        changeType: 'SUPPLIER_DELIVERY',
        quantityBefore: before,
        quantityAfter: after,
        delta: roundQuantity(after - before),
        note: copy.intakeNote(supplierName),
        actor,
        savedAt: now,
      });
    }

    for (const product of updatedProducts) {
      transaction.set(doc(db, 'products', product.id), productToFirestore(product));
    }

    const received: SupplierIntake = {
      deliveryId,
      supplierName,
      items: parsedItems.filter((item) => item.productId && item.addedQuantity > 0),
      status: 'RECEIVED_COMPLETED',
      createdAt:
        intakeRaw.createdAt && typeof (intakeRaw.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (intakeRaw.createdAt as { toDate: () => Date }).toDate().toISOString()
          : now,
      updatedAt: now,
      receivedAt: now,
    };
    transaction.set(intakeRef, {
      ...intakeToFirestore(received),
      receivedAt: Timestamp.fromDate(new Date(now)),
    });

    for (const entry of history) {
      transaction.set(doc(db, 'history', entry.id), historyToFirestore(entry));
    }

    return { deliveryId, receivedAt: now, lines, history };
  });
}
