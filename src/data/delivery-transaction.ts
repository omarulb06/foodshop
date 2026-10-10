import { doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';

import {
  historyToFirestore,
  orderToFirestore,
  productToFirestore,
} from '@/data/firestore-mappers';
import { copy } from '@/lib/copy';
import { quantitiesByProduct, type DeliveryApply, type DeliveryLine } from '@/lib/delivery';
import { createId } from '@/lib/ids';
import { InventoryError } from '@/lib/errors';
import { formatQuantity, roundQuantity } from '@/lib/quantity';
import { DEFAULT_MIN_STOCK } from '@/lib/stock';
import type { HistoryEntry, Order, Product } from '@/types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Reads the order and every product, then writes the new stock, the delivered
 * order and the history rows in one transaction. All reads happen before writes.
 */
export async function runDeliveryTransaction(
  db: Firestore,
  orderId: string,
  actor: string,
  now: string
): Promise<DeliveryApply> {
  const orderRef = doc(db, 'orders', orderId);

  return runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new InventoryError(copy.orderMissing);

    const orderRaw = asRecord(orderSnap.data());
    if (orderRaw.status !== 'DRAFT') throw new InventoryError(copy.orderAlreadyDelivered);

    const items = Array.isArray(orderRaw.items) ? orderRaw.items : [];
    const parsedItems = items.map((item) => {
      const record = asRecord(item);
      return {
        productId: typeof record.productId === 'string' ? record.productId : '',
        productName: typeof record.productName === 'string' ? record.productName : '',
        quantity: typeof record.quantity === 'number' ? record.quantity : 0,
        price: typeof record.price === 'number' ? record.price : 0,
      };
    });
    const needed = quantitiesByProduct(parsedItems.filter((item) => item.productId));
    if (needed.size === 0) throw new InventoryError(copy.orderNeedsItems);

    const productRefs = [...needed.keys()].map((productId) => doc(db, 'products', productId));
    const productSnaps = [];
    for (const productRef of productRefs) {
      productSnaps.push(await transaction.get(productRef));
    }

    const lines: DeliveryLine[] = [];
    const history: HistoryEntry[] = [];
    const updatedProducts: Product[] = [];
    const batchId = createId('batch');

    for (let index = 0; index < productSnaps.length; index += 1) {
      const snap = productSnaps[index];
      const productId = productRefs[index].id;
      const request = needed.get(productId);
      if (!request) continue;
      if (!snap.exists()) throw new InventoryError(copy.productMissing(request.name || productId));

      const data = asRecord(snap.data());
      const before = typeof data.quantity === 'number' && Number.isFinite(data.quantity) ? data.quantity : 0;
      const reservedBefore =
        typeof data.reservedQuantity === 'number' && Number.isFinite(data.reservedQuantity)
          ? data.reservedQuantity
          : 0;
      const minStockLimit =
        typeof data.minStockLimit === 'number' && Number.isFinite(data.minStockLimit)
          ? Math.max(0, data.minStockLimit)
          : DEFAULT_MIN_STOCK;
      if (request.quantity > before) {
        throw new InventoryError(
          copy.notEnoughStock(request.name || productId, formatQuantity(before), formatQuantity(request.quantity))
        );
      }

      const after = roundQuantity(before - request.quantity);
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
        reservedQuantity: roundQuantity(Math.max(0, reservedBefore - request.quantity)),
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
        sold: request.quantity,
      });
      history.push({
        id: createId('entry'),
        batchId,
        productId,
        productName: name,
        unit,
        kind: 'remove',
        changeType: 'ORDER_DELIVERED',
        quantityBefore: before,
        quantityAfter: after,
        delta: roundQuantity(after - before),
        note: copy.deliveryNote(typeof orderRaw.customerName === 'string' ? orderRaw.customerName : ''),
        actor,
        savedAt: now,
      });
    }

    for (const product of updatedProducts) {
      transaction.set(doc(db, 'products', product.id), productToFirestore(product));
    }

    const delivered: Order = {
      orderId,
      customerName: typeof orderRaw.customerName === 'string' ? orderRaw.customerName : '',
      items: parsedItems.filter((item) => item.productId && item.quantity > 0),
      status: 'APPROVED_DELIVERED',
      createdAt:
        orderRaw.createdAt && typeof (orderRaw.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (orderRaw.createdAt as { toDate: () => Date }).toDate().toISOString()
          : now,
      updatedAt: now,
      deliveredAt: now,
    };
    transaction.set(orderRef, {
      ...orderToFirestore(delivered),
      deliveredAt: Timestamp.fromDate(new Date(now)),
    });

    for (const entry of history) {
      transaction.set(doc(db, 'history', entry.id), historyToFirestore(entry));
    }

    return { orderId, deliveredAt: now, lines, history };
  });
}
