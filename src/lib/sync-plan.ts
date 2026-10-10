import { createId } from '@/lib/ids';
import type { InventoryData, Order, Product, SupplierIntake, SyncOp, SyncOpKind } from '@/types';

export interface FlushOp {
  kind: SyncOpKind;
  productId?: string;
  orderId?: string;
  deliveryId?: string;
  entryIds?: string[];
  /** Ids of the stored outbox rows consumed by this write. */
  sourceIds: string[];
}

function productSignature(product: Product): string {
  return [
    product.name,
    product.unit,
    product.unitId,
    String(product.quantity),
    String(product.reservedQuantity),
    String(product.minStockLimit),
    product.updatedAt,
  ].join('\u0000');
}

function orderSignature(order: Order): string {
  const items = order.items
    .map((item) => [item.productId, item.productName, String(item.quantity), String(item.price)].join('\u0001'))
    .join('\u0002');
  return [order.customerName, order.status, items, order.updatedAt].join('\u0000');
}

function intakeSignature(intake: SupplierIntake): string {
  const items = intake.items
    .map((item) =>
      [item.productId, item.productName, String(item.addedQuantity), String(item.unitCost)].join('\u0001')
    )
    .join('\u0002');
  return [intake.supplierName, intake.status, items, intake.updatedAt].join('\u0000');
}

/** Describes what changed between two snapshots. The outbox itself is ignored. */
export function planSyncOps(
  previous: InventoryData,
  next: InventoryData,
  newId: () => string = () => createId('sync')
): SyncOp[] {
  const ops: SyncOp[] = [];
  const previousProducts = new Map(previous.products.map((product) => [product.id, product]));
  const nextProducts = new Map(next.products.map((product) => [product.id, product]));

  for (const product of next.products) {
    const before = previousProducts.get(product.id);
    if (!before || productSignature(before) !== productSignature(product)) {
      ops.push({ id: newId(), kind: 'upsert-product', productId: product.id });
    }
  }
  for (const product of previous.products) {
    if (!nextProducts.has(product.id)) {
      ops.push({ id: newId(), kind: 'delete-product', productId: product.id });
    }
  }

  const knownHistory = new Set(previous.history.map((entry) => entry.id));
  const entryIds = next.history.filter((entry) => !knownHistory.has(entry.id)).map((entry) => entry.id);
  if (entryIds.length > 0) {
    ops.push({ id: newId(), kind: 'append-history', entryIds });
  }

  if (previous.lastActor !== next.lastActor) {
    ops.push({ id: newId(), kind: 'settings' });
  }

  const previousOrders = new Map(previous.orders.map((order) => [order.orderId, order]));
  const nextOrders = new Map(next.orders.map((order) => [order.orderId, order]));

  for (const order of next.orders) {
    const before = previousOrders.get(order.orderId);
    const changed = !before || orderSignature(before) !== orderSignature(order);
    if (!changed) continue;
    // A status change from draft to delivered is written by the delivery transaction.
    // A delivered order that has never been uploaded (this device worked offline) still needs a set.
    if (before && before.status === 'DRAFT' && order.status === 'APPROVED_DELIVERED') continue;
    if (order.status === 'DRAFT' || !before) {
      ops.push({ id: newId(), kind: 'upsert-order', orderId: order.orderId });
    }
  }
  for (const order of previous.orders) {
    if (!nextOrders.has(order.orderId)) {
      ops.push({ id: newId(), kind: 'delete-order', orderId: order.orderId });
    }
  }

  const previousIntakes = new Map(previous.intakes.map((intake) => [intake.deliveryId, intake]));
  const nextIntakes = new Map(next.intakes.map((intake) => [intake.deliveryId, intake]));

  for (const intake of next.intakes) {
    const before = previousIntakes.get(intake.deliveryId);
    const changed = !before || intakeSignature(before) !== intakeSignature(intake);
    if (!changed) continue;
    if (before && before.status === 'DRAFT' && intake.status === 'RECEIVED_COMPLETED') continue;
    if (intake.status === 'DRAFT' || !before) {
      ops.push({ id: newId(), kind: 'upsert-intake', deliveryId: intake.deliveryId });
    }
  }
  for (const intake of previous.intakes) {
    if (!nextIntakes.has(intake.deliveryId)) {
      ops.push({ id: newId(), kind: 'delete-intake', deliveryId: intake.deliveryId });
    }
  }

  return ops;
}

/** Collapses repeated edits of the same document so the newest one is what we send. */
export function coalesceOps(ops: SyncOp[]): FlushOp[] {
  const products = new Map<string, FlushOp>();
  const orders = new Map<string, FlushOp>();
  const intakes = new Map<string, FlushOp>();
  const historyIds: string[] = [];
  const historySources: string[] = [];
  const settingsSources: string[] = [];

  for (const op of ops) {
    if ((op.kind === 'upsert-product' || op.kind === 'delete-product') && op.productId) {
      const existing = products.get(op.productId);
      products.set(op.productId, {
        kind: op.kind,
        productId: op.productId,
        sourceIds: [...(existing?.sourceIds ?? []), op.id],
      });
      continue;
    }
    if ((op.kind === 'upsert-intake' || op.kind === 'delete-intake') && op.deliveryId) {
      const existing = intakes.get(op.deliveryId);
      intakes.set(op.deliveryId, {
        kind: op.kind,
        deliveryId: op.deliveryId,
        sourceIds: [...(existing?.sourceIds ?? []), op.id],
      });
      continue;
    }
    if ((op.kind === 'upsert-order' || op.kind === 'delete-order') && op.orderId) {
      const existing = orders.get(op.orderId);
      orders.set(op.orderId, {
        kind: op.kind,
        orderId: op.orderId,
        sourceIds: [...(existing?.sourceIds ?? []), op.id],
      });
      continue;
    }
    if (op.kind === 'append-history') {
      historySources.push(op.id);
      for (const entryId of op.entryIds ?? []) {
        if (!historyIds.includes(entryId)) historyIds.push(entryId);
      }
      continue;
    }
    if (op.kind === 'settings') {
      settingsSources.push(op.id);
    }
  }

  const planned: FlushOp[] = [];
  if (settingsSources.length > 0) {
    planned.push({ kind: 'settings', sourceIds: settingsSources });
  }
  for (const op of products.values()) planned.push(op);
  for (const op of orders.values()) planned.push(op);
  for (const op of intakes.values()) planned.push(op);
  if (historySources.length > 0) {
    planned.push({ kind: 'append-history', entryIds: historyIds, sourceIds: historySources });
  }
  return planned;
}
