import { roundQuantity } from '@/lib/quantity';
import type { InventoryData, OrderItem, Product } from '@/types';

export const DEFAULT_MIN_STOCK = 5;

export function availableQuantity(product: Product): number {
  return roundQuantity(product.quantity - product.reservedQuantity);
}

export function isLowStock(product: Product): boolean {
  return availableQuantity(product) <= product.minStockLimit;
}

/** Sums draft lines. Delivered orders do not keep a reservation. */
export function reservedByProduct(data: InventoryData, excludeOrderId?: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const order of data.orders) {
    if (order.status !== 'DRAFT' || order.orderId === excludeOrderId) continue;
    for (const item of order.items) {
      totals.set(
        item.productId,
        roundQuantity((totals.get(item.productId) ?? 0) + item.quantity)
      );
    }
  }
  return totals;
}

/** Rewrites `reservedQuantity` so it matches the draft orders currently stored. */
export function applyReservations(data: InventoryData): InventoryData {
  const reserved = reservedByProduct(data);
  let changed = false;
  const products = data.products.map((product) => {
    const reservedQuantity = reserved.get(product.id) ?? 0;
    if (product.reservedQuantity === reservedQuantity) return product;
    changed = true;
    return { ...product, reservedQuantity };
  });
  return changed ? { ...data, products } : data;
}

/**
 * How much of a product this draft may take.
 * The draft's own saved lines are not counted against it.
 */
export function availableForDraft(data: InventoryData, productId: string, excludeOrderId?: string): number {
  const product = data.products.find((item) => item.id === productId);
  if (!product) return 0;
  const heldByOthers = reservedByProduct(data, excludeOrderId).get(productId) ?? 0;
  return roundQuantity(product.quantity - heldByOthers);
}

export interface DraftOverflow {
  name: string;
  available: number;
  requested: number;
}

export function draftOverflow(
  data: InventoryData,
  items: OrderItem[],
  excludeOrderId?: string
): DraftOverflow | null {
  const requested = new Map<string, { quantity: number; name: string }>();
  for (const item of items) {
    const current = requested.get(item.productId);
    requested.set(item.productId, {
      quantity: roundQuantity((current?.quantity ?? 0) + item.quantity),
      name: item.productName || current?.name || item.productId,
    });
  }

  for (const [productId, request] of requested) {
    const product = data.products.find((item) => item.id === productId);
    const available = availableForDraft(data, productId, excludeOrderId);
    if (request.quantity > available) {
      return {
        name: product?.name || request.name,
        available,
        requested: request.quantity,
      };
    }
  }
  return null;
}

/** Names of products that were not low before and are low now. */
export function productsThatBecameLow(before: Product[], after: Product[]): string[] {
  const wasLow = new Set(before.filter(isLowStock).map((product) => product.id));
  return after.filter((product) => isLowStock(product) && !wasLow.has(product.id)).map((product) => product.name);
}
