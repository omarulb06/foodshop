import { coalesceOps, planSyncOps } from '@/lib/sync-plan';
import type { InventoryData, Order, Product } from '@/types';

function blank(): InventoryData {
  return {
    schemaVersion: 2,
    products: [],
    history: [],
    orders: [],
    intakes: [],
    lastActor: '',
    outbox: [],
    cloudSeeded: false,
  };
}

let sequence = 0;
function nextId(): string {
  sequence += 1;
  return `op-${sequence}`;
}

function product(id: string, quantity: number): Product {
  return {
    id,
    name: id,
    unit: 'יחידות',
    unitId: 'pieces',
    quantity,
    reservedQuantity: 0,
    minStockLimit: 5,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('planSyncOps', () => {
  beforeEach(() => {
    sequence = 0;
  });

  it('queues an upsert for a new or edited product and ignores delivered orders', () => {
    const previous = blank();
    const created = product('a', 1);
    const order: Order = {
      orderId: 'o1',
      customerName: 'לקוח',
      items: [{ productId: 'a', productName: 'a', quantity: 1, price: 0 }],
      status: 'APPROVED_DELIVERED',
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      deliveredAt: '2026-10-02T00:00:00.000Z',
    };
    const next: InventoryData = { ...previous, products: [created], orders: [order] };

    const ops = planSyncOps(previous, next, nextId);
    expect(ops.map((op) => op.kind)).toEqual(['upsert-product', 'upsert-order']);
  });

  it('queues a delete when a product disappears and an upsert for a draft', () => {
    const kept = product('keep', 1);
    const removed = product('gone', 1);
    const previous: InventoryData = { ...blank(), products: [kept, removed] };
    const draft: Order = {
      orderId: 'draft-1',
      customerName: 'לקוח',
      items: [{ productId: 'keep', productName: 'keep', quantity: 1, price: 2 }],
      status: 'DRAFT',
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      deliveredAt: null,
    };
    const next: InventoryData = { ...previous, products: [kept], orders: [draft] };

    const ops = planSyncOps(previous, next, nextId);
    expect(ops.map((op) => op.kind)).toEqual(['delete-product', 'upsert-order']);
  });

  it('queues a product upsert when only the reservation changes', () => {
    const previous: InventoryData = { ...blank(), products: [product('a', 10)] };
    const next: InventoryData = {
      ...previous,
      products: [{ ...product('a', 10), reservedQuantity: 2 }],
    };
    const ops = planSyncOps(previous, next, nextId);
    expect(ops.map((op) => op.kind)).toEqual(['upsert-product']);
  });
});

describe('coalesceOps', () => {
  it('lets the newest edit of a product win', () => {
    const planned = coalesceOps([
      { id: '1', kind: 'upsert-product', productId: 'a' },
      { id: '2', kind: 'upsert-product', productId: 'a' },
      { id: '3', kind: 'delete-product', productId: 'a' },
    ]);
    expect(planned).toEqual([
      { kind: 'delete-product', productId: 'a', sourceIds: ['1', '2', '3'] },
    ]);
  });
});
