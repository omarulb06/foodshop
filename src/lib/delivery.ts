import { copy } from '@/lib/copy';
import { createId } from '@/lib/ids';
import { formatQuantity, roundQuantity } from '@/lib/quantity';
import { applyReservations } from '@/lib/stock';
import type { HistoryEntry, InventoryData, Order, OrderItem } from '@/types';

export interface DeliveryLine {
  productId: string;
  productName: string;
  unit: string;
  quantityBefore: number;
  quantityAfter: number;
  sold: number;
}

export interface DeliveryApply {
  orderId: string;
  deliveredAt: string;
  lines: DeliveryLine[];
  history: HistoryEntry[];
}

export type DeliveryPlan =
  | { ok: true; next: InventoryData }
  | { ok: false; error: string };

/** Sums repeated lines of the same product so one order cannot deduct twice by accident. */
export function quantitiesByProduct(items: OrderItem[]): Map<string, { quantity: number; name: string }> {
  const totals = new Map<string, { quantity: number; name: string }>();
  for (const item of items) {
    const current = totals.get(item.productId);
    totals.set(item.productId, {
      quantity: roundQuantity((current?.quantity ?? 0) + item.quantity),
      name: item.productName || current?.name || '',
    });
  }
  return totals;
}

/**
 * Checks a draft against the stock currently known on this device.
 * A draft itself never changes stock; only this plan does.
 */
export function planDelivery(
  data: InventoryData,
  orderId: string,
  now: string,
  actor: string
): DeliveryPlan {
  const order = data.orders.find((item) => item.orderId === orderId);
  if (!order) return { ok: false, error: copy.orderMissing };
  if (order.status !== 'DRAFT') return { ok: false, error: copy.orderAlreadyDelivered };
  if (order.items.length === 0) return { ok: false, error: copy.orderNeedsItems };

  const needed = quantitiesByProduct(order.items);
  const quantities = new Map(data.products.map((product) => [product.id, product.quantity]));
  const history: HistoryEntry[] = [];
  const batchId = createId('batch');
  const lines: DeliveryLine[] = [];

  for (const [productId, request] of needed) {
    if (request.quantity <= 0) return { ok: false, error: copy.orderNeedsItems };
    const product = data.products.find((item) => item.id === productId);
    if (!product) return { ok: false, error: copy.productMissing(request.name || productId) };

    const before = quantities.get(product.id) ?? product.quantity;
    if (request.quantity > before) {
      return {
        ok: false,
        error: copy.notEnoughStock(
          product.name,
          formatQuantity(before),
          formatQuantity(request.quantity)
        ),
      };
    }

    const after = roundQuantity(before - request.quantity);
    quantities.set(product.id, after);
    lines.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantityBefore: before,
      quantityAfter: after,
      sold: request.quantity,
    });
    history.push({
      id: createId('entry'),
      batchId,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      kind: 'remove',
      changeType: 'ORDER_DELIVERED',
      quantityBefore: before,
      quantityAfter: after,
      delta: roundQuantity(after - before),
      note: copy.deliveryNote(order.customerName),
      actor,
      savedAt: now,
    });
  }

  const delivered: Order = {
    ...order,
    status: 'APPROVED_DELIVERED',
    deliveredAt: now,
    updatedAt: now,
  };

  return {
    ok: true,
    next: applyDeliveryResult(data, {
      orderId,
      deliveredAt: now,
      lines,
      history,
    }, delivered),
  };
}

export function applyDeliveryResult(
  data: InventoryData,
  result: DeliveryApply,
  orderOverride?: Order
): InventoryData {
  const after = new Map(result.lines.map((line) => [line.productId, line.quantityAfter]));
  const existing = data.orders.find((order) => order.orderId === result.orderId);

  const delivered: Order | null = orderOverride
    ? orderOverride
    : existing
      ? {
          ...existing,
          status: 'APPROVED_DELIVERED',
          deliveredAt: result.deliveredAt,
          updatedAt: result.deliveredAt,
        }
      : null;

  return applyReservations({
    ...data,
    products: data.products.map((product) => {
      const quantity = after.get(product.id);
      return quantity === undefined ? product : { ...product, quantity, updatedAt: result.deliveredAt };
    }),
    orders: delivered
      ? data.orders.map((order) => (order.orderId === result.orderId ? delivered : order))
      : data.orders,
    history: [...data.history, ...result.history],
  });
}
