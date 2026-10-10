import { roundQuantity } from '@/lib/quantity';
import type { Order, OrderItem, OrderStatus } from '@/types';

export function orderTotal(items: OrderItem[]): number {
  return roundQuantity(items.reduce((sum, item) => sum + item.quantity * item.price, 0));
}

export function formatPrice(value: number): string {
  const rounded = roundQuantity(value);
  const fixed = rounded.toFixed(2);
  return `₪${fixed}`;
}

export function statusRank(status: OrderStatus): number {
  return status === 'DRAFT' ? 0 : 1;
}

export function compareOrders(a: Order, b: Order): number {
  const difference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return difference !== 0 ? difference : b.orderId.localeCompare(a.orderId);
}
