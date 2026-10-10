import { copy } from '@/lib/copy';
import { createId } from '@/lib/ids';
import { MAX_QUANTITY, roundQuantity } from '@/lib/quantity';
import { applyReservations } from '@/lib/stock';
import type { HistoryEntry, IntakeItem, InventoryData, SupplierIntake } from '@/types';

export interface IntakeLine {
  productId: string;
  productName: string;
  unit: string;
  quantityBefore: number;
  quantityAfter: number;
  added: number;
}

export interface IntakeApply {
  deliveryId: string;
  receivedAt: string;
  lines: IntakeLine[];
  history: HistoryEntry[];
}

export type IntakePlan = { ok: true; next: InventoryData } | { ok: false; error: string };

export function addedByProduct(items: IntakeItem[]): Map<string, { quantity: number; name: string }> {
  const totals = new Map<string, { quantity: number; name: string }>();
  for (const item of items) {
    const current = totals.get(item.productId);
    totals.set(item.productId, {
      quantity: roundQuantity((current?.quantity ?? 0) + item.addedQuantity),
      name: item.productName || current?.name || '',
    });
  }
  return totals;
}

/**
 * Adds a received shipment onto the stock known on this device.
 * A draft itself never changes stock; only this plan does.
 */
export function planReceive(
  data: InventoryData,
  deliveryId: string,
  now: string,
  actor: string
): IntakePlan {
  const intake = data.intakes.find((item) => item.deliveryId === deliveryId);
  if (!intake) return { ok: false, error: copy.intakeMissing };
  if (intake.status !== 'DRAFT') return { ok: false, error: copy.intakeAlreadyReceived };
  if (intake.items.length === 0) return { ok: false, error: copy.intakeNeedsItems };

  const needed = addedByProduct(intake.items);
  const quantities = new Map(data.products.map((product) => [product.id, product.quantity]));
  const history: HistoryEntry[] = [];
  const batchId = createId('batch');
  const lines: IntakeLine[] = [];

  for (const [productId, request] of needed) {
    if (request.quantity <= 0) return { ok: false, error: copy.intakeNeedsItems };
    const product = data.products.find((item) => item.id === productId);
    if (!product) return { ok: false, error: copy.productMissing(request.name || productId) };

    const before = quantities.get(product.id) ?? product.quantity;
    const after = roundQuantity(before + request.quantity);
    if (after > MAX_QUANTITY) return { ok: false, error: copy.quantityMax(MAX_QUANTITY) };

    quantities.set(product.id, after);
    lines.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantityBefore: before,
      quantityAfter: after,
      added: request.quantity,
    });
    history.push({
      id: createId('entry'),
      batchId,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      kind: 'add',
      changeType: 'SUPPLIER_DELIVERY',
      quantityBefore: before,
      quantityAfter: after,
      delta: roundQuantity(after - before),
      note: copy.intakeNote(intake.supplierName),
      actor,
      savedAt: now,
    });
  }

  const received: SupplierIntake = {
    ...intake,
    status: 'RECEIVED_COMPLETED',
    receivedAt: now,
    updatedAt: now,
  };

  return {
    ok: true,
    next: applyIntakeResult(
      data,
      { deliveryId, receivedAt: now, lines, history },
      received
    ),
  };
}

export function applyIntakeResult(
  data: InventoryData,
  result: IntakeApply,
  intakeOverride?: SupplierIntake
): InventoryData {
  const after = new Map(result.lines.map((line) => [line.productId, line.quantityAfter]));
  const existing = data.intakes.find((item) => item.deliveryId === result.deliveryId);
  const received: SupplierIntake | null = intakeOverride
    ? intakeOverride
    : existing
      ? {
          ...existing,
          status: 'RECEIVED_COMPLETED',
          receivedAt: result.receivedAt,
          updatedAt: result.receivedAt,
        }
      : null;

  return applyReservations({
    ...data,
    products: data.products.map((product) => {
      const quantity = after.get(product.id);
      return quantity === undefined ? product : { ...product, quantity, updatedAt: result.receivedAt };
    }),
    intakes: received
      ? data.intakes.map((item) => (item.deliveryId === result.deliveryId ? received : item))
      : data.intakes,
    history: [...data.history, ...result.history],
  });
}

export function compareIntakes(a: SupplierIntake, b: SupplierIntake): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}
