import type { Order, Product, SupplierIntake, SyncOp } from '@/types';

function pendingIds(outbox: SyncOp[], kinds: SyncOp['kind'][]): Set<string> {
  const ids = new Set<string>();
  for (const op of outbox) {
    if (!kinds.includes(op.kind)) continue;
    const id = op.productId ?? op.orderId ?? op.deliveryId;
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Combines a server snapshot with local rows.
 * A newer local `updatedAt` wins over a stale snapshot, and rows still waiting
 * in the outbox are never overwritten or dropped.
 */
export function mergeDocuments<T extends { updatedAt: string }>(
  local: T[],
  remote: T[],
  idOf: (item: T) => string,
  pending: Set<string>,
  trustAbsence: boolean
): T[] {
  if (remote.length === 0) {
    if (!trustAbsence) return local;
    return local.filter((item) => pending.has(idOf(item)));
  }

  const localById = new Map(local.map((item) => [idOf(item), item]));
  const merged: T[] = [];
  const seen = new Set<string>();
  let newestRemote = 0;
  for (const item of remote) {
    newestRemote = Math.max(newestRemote, new Date(item.updatedAt).getTime());
  }

  for (const remoteItem of remote) {
    const id = idOf(remoteItem);
    seen.add(id);
    const localItem = localById.get(id);
    if (pending.has(id)) {
      if (localItem) merged.push(localItem);
      continue;
    }
    if (!localItem) {
      merged.push(remoteItem);
      continue;
    }
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
    merged.push(localTime > remoteTime ? localItem : remoteItem);
  }

  for (const localItem of local) {
    const id = idOf(localItem);
    if (seen.has(id)) continue;
    if (pending.has(id)) {
      merged.push(localItem);
      continue;
    }
    if (!trustAbsence || new Date(localItem.updatedAt).getTime() > newestRemote) {
      merged.push(localItem);
    }
  }

  return merged;
}

export function mergeProducts(
  local: Product[],
  remote: Product[],
  outbox: SyncOp[],
  trustAbsence: boolean
): Product[] {
  return mergeDocuments(
    local,
    remote,
    (product) => product.id,
    pendingIds(outbox, ['upsert-product', 'delete-product']),
    trustAbsence
  );
}

export function mergeOrders(
  local: Order[],
  remote: Order[],
  outbox: SyncOp[],
  trustAbsence: boolean
): Order[] {
  return mergeDocuments(
    local,
    remote,
    (order) => order.orderId,
    pendingIds(outbox, ['upsert-order', 'delete-order']),
    trustAbsence
  );
}

export function mergeIntakes(
  local: SupplierIntake[],
  remote: SupplierIntake[],
  outbox: SyncOp[],
  trustAbsence: boolean
): SupplierIntake[] {
  return mergeDocuments(
    local,
    remote,
    (intake) => intake.deliveryId,
    pendingIds(outbox, ['upsert-intake', 'delete-intake']),
    trustAbsence
  );
}
