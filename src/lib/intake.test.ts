import { planReceive } from '@/lib/intake';
import type { InventoryData, Order, Product, SupplierIntake } from '@/types';

function product(id: string, quantity: number, reservedQuantity = 0): Product {
  return {
    id,
    name: id,
    unit: 'יחידות',
    unitId: 'pieces',
    quantity,
    reservedQuantity,
    minStockLimit: 5,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function draft(): SupplierIntake {
  return {
    deliveryId: 'in-1',
    supplierName: 'מחסן',
    items: [{ productId: 'milk', productName: 'חלב', addedQuantity: 4, unitCost: 2 }],
    status: 'DRAFT',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    receivedAt: null,
  };
}

function holdingOrder(): Order {
  return {
    orderId: 'order-1',
    customerName: 'לקוח',
    items: [{ productId: 'milk', productName: 'חלב', quantity: 3, price: 1 }],
    status: 'DRAFT',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    deliveredAt: null,
  };
}

function inventory(products: Product[], intakes: SupplierIntake[], orders: Order[] = []): InventoryData {
  return {
    schemaVersion: 2,
    products,
    history: [],
    orders,
    intakes,
    lastActor: '',
    outbox: [],
    cloudSeeded: false,
  };
}

describe('planReceive', () => {
  it('keeps stock unchanged on a draft and adds it once when received', () => {
    const data = inventory([{ ...product('milk', 10, 3), name: 'חלב' }], [draft()], [holdingOrder()]);
    expect(data.products[0].quantity).toBe(10);

    const plan = planReceive(data, 'in-1', '2026-10-02T12:00:00.000Z', 'קבלת סחורה');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.next.products[0].quantity).toBe(14);
    expect(plan.next.products[0].reservedQuantity).toBe(3);
    expect(plan.next.intakes[0].status).toBe('RECEIVED_COMPLETED');
    expect(plan.next.history[0].changeType).toBe('SUPPLIER_DELIVERY');
    expect(plan.next.history[0].delta).toBe(4);
  });

  it('refuses a shipment that was already received', () => {
    const received: SupplierIntake = { ...draft(), status: 'RECEIVED_COMPLETED', receivedAt: '2026-10-02T01:00:00.000Z' };
    const plan = planReceive(inventory([product('milk', 10)], [received]), 'in-1', '2026-10-02T12:00:00.000Z', 'קבלת סחורה');
    expect(plan.ok).toBe(false);
  });
});
