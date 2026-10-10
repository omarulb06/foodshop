import { Timestamp } from 'firebase/firestore';

import type { HistoryEntry, IntakeItem, Order, OrderItem, Product, SupplierIntake } from '@/types';

export function readTimestamp(value: unknown, fallback?: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString();
  }
  return fallback ?? new Date(0).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function productFromFirestore(id: string, raw: unknown): Record<string, unknown> {
  const data = asRecord(raw);
  const createdAt = readTimestamp(data.createdAt);
  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    name: data.name,
    quantity: data.quantity,
    reservedQuantity: data.reservedQuantity,
    minStockLimit: data.minStockLimit,
    unit: data.unit,
    unitId: data.unitId,
    createdAt,
    updatedAt: readTimestamp(data.lastUpdated ?? data.updatedAt, createdAt),
  };
}

export function productToFirestore(product: Product) {
  return {
    id: product.id,
    name: product.name,
    quantity: product.quantity,
    reservedQuantity: product.reservedQuantity,
    minStockLimit: product.minStockLimit,
    lastUpdated: Timestamp.fromDate(new Date(product.updatedAt)),
    unit: product.unit,
    unitId: product.unitId,
    createdAt: Timestamp.fromDate(new Date(product.createdAt)),
  };
}

export function orderFromFirestore(id: string, raw: unknown): Record<string, unknown> {
  const data = asRecord(raw);
  const createdAt = readTimestamp(data.createdAt);
  const deliveredAt = data.deliveredAt == null ? '' : readTimestamp(data.deliveredAt, '');
  return {
    orderId: typeof data.orderId === 'string' && data.orderId ? data.orderId : id,
    customerName: data.customerName,
    items: Array.isArray(data.items) ? data.items.map(orderItemFromFirestore) : [],
    status: data.status,
    createdAt,
    updatedAt: readTimestamp(data.updatedAt, createdAt),
    deliveredAt,
  };
}

function orderItemFromFirestore(raw: unknown): OrderItem | Record<string, unknown> {
  const data = asRecord(raw);
  return {
    productId: data.productId,
    productName: data.productName,
    quantity: data.quantity,
    price: data.price,
  } as OrderItem;
}

export function orderToFirestore(order: Order) {
  return {
    orderId: order.orderId,
    customerName: order.customerName,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
    })),
    status: order.status,
    createdAt: Timestamp.fromDate(new Date(order.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(order.updatedAt)),
    deliveredAt: order.deliveredAt ? Timestamp.fromDate(new Date(order.deliveredAt)) : null,
  };
}

export function intakeFromFirestore(id: string, raw: unknown): Record<string, unknown> {
  const data = asRecord(raw);
  const createdAt = readTimestamp(data.createdAt);
  const receivedAt = data.receivedAt == null ? '' : readTimestamp(data.receivedAt, '');
  return {
    deliveryId: typeof data.deliveryId === 'string' && data.deliveryId ? data.deliveryId : id,
    supplierName: data.supplierName,
    items: Array.isArray(data.items) ? data.items.map(intakeItemFromFirestore) : [],
    status: data.status,
    createdAt,
    updatedAt: readTimestamp(data.updatedAt, createdAt),
    receivedAt,
  };
}

function intakeItemFromFirestore(raw: unknown): IntakeItem {
  const data = asRecord(raw);
  return {
    productId: typeof data.productId === 'string' ? data.productId : '',
    productName: typeof data.productName === 'string' ? data.productName : '',
    addedQuantity: typeof data.addedQuantity === 'number' ? data.addedQuantity : 0,
    unitCost: typeof data.unitCost === 'number' ? data.unitCost : 0,
  };
}

export function intakeToFirestore(intake: SupplierIntake) {
  return {
    deliveryId: intake.deliveryId,
    supplierName: intake.supplierName,
    items: intake.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      addedQuantity: item.addedQuantity,
      unitCost: item.unitCost,
    })),
    status: intake.status,
    createdAt: Timestamp.fromDate(new Date(intake.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(intake.updatedAt)),
    receivedAt: intake.receivedAt ? Timestamp.fromDate(new Date(intake.receivedAt)) : null,
  };
}

export function historyFromFirestore(id: string, raw: unknown): Record<string, unknown> {
  const data = asRecord(raw);
  return {
    ...data,
    id: typeof data.id === 'string' && data.id ? data.id : id,
    savedAt: readTimestamp(data.savedAt ?? data.timestamp),
    quantityAfter: data.quantityAfter ?? data.newQuantity,
    delta: data.delta ?? data.amountChanged,
    changeType: data.changeType,
    kind: data.kind ?? (data.changeType === 'ORDER_DELIVERED' ? 'remove' : 'set'),
  };
}

export function historyToFirestore(entry: HistoryEntry) {
  const savedAt = Timestamp.fromDate(new Date(entry.savedAt));
  return {
    ...entry,
    savedAt,
    timestamp: savedAt,
    newQuantity: entry.quantityAfter,
    amountChanged: entry.delta,
    changeType: entry.changeType,
  };
}
