import { planDelivery } from '@/lib/delivery';
import type { InventoryData, Order, Product } from '@/types';

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

function draft(items: Order['items']): Order {
  return {
    orderId: 'order-1',
    customerName: 'לקוח',
    items,
    status: 'DRAFT',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    deliveredAt: null,
  };
}

function inventory(products: Product[], orders: Order[]): InventoryData {
  return {
    schemaVersion: 2,
    products,
    history: [],
    orders,
    intakes: [],
    lastActor: '',
    outbox: [],
    cloudSeeded: false,
  };
}

describe('planDelivery', () => {
  it('keeps stock unchanged until delivery and then deducts once', () => {
    const data = inventory(
      [product('milk', 10)],
      [draft([{ productId: 'milk', productName: 'milk', quantity: 4, price: 5 }])]
    );

    expect(data.products[0].quantity).toBe(10);

    const plan = planDelivery(data, 'order-1', '2026-10-02T12:00:00.000Z', 'אספקה');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.next.products[0].quantity).toBe(6);
    expect(plan.next.orders[0].status).toBe('APPROVED_DELIVERED');
    expect(plan.next.orders[0].deliveredAt).toBe('2026-10-02T12:00:00.000Z');
    expect(plan.next.history).toHaveLength(1);
    expect(plan.next.history[0].kind).toBe('remove');
    expect(plan.next.history[0].changeType).toBe('ORDER_DELIVERED');
    expect(plan.next.history[0].delta).toBe(-4);
    expect(plan.next.products[0].reservedQuantity).toBe(0);
  });

  it('refuses delivery when stock is short and changes nothing', () => {
    const data = inventory(
      [{ ...product('milk', 2), name: 'חלב' }],
      [draft([{ productId: 'milk', productName: 'חלב', quantity: 5, price: 0 }])]
    );
    const plan = planDelivery(data, 'order-1', '2026-10-02T12:00:00.000Z', 'אספקה');
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain('חלב');
    expect(data.products[0].quantity).toBe(2);
  });

  it('sums two lines of the same product before deducting', () => {
    const data = inventory(
      [product('rice', 10)],
      [
        draft([
          { productId: 'rice', productName: 'אורז', quantity: 3, price: 1 },
          { productId: 'rice', productName: 'אורז', quantity: 2, price: 1 },
        ]),
      ]
    );
    const plan = planDelivery(data, 'order-1', '2026-10-02T12:00:00.000Z', 'אספקה');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.next.products[0].quantity).toBe(5);
    expect(plan.next.history).toHaveLength(1);
  });

  it('releases the delivered reservation and keeps other drafts', () => {
    const data = inventory(
      [{ ...product('milk', 10), name: 'חלב', reservedQuantity: 6 }],
      [
        draft([{ productId: 'milk', productName: 'חלב', quantity: 4, price: 1 }]),
        {
          ...draft([{ productId: 'milk', productName: 'חלב', quantity: 2, price: 1 }]),
          orderId: 'order-2',
        },
      ]
    );
    const plan = planDelivery(data, 'order-1', '2026-10-02T12:00:00.000Z', 'אספקה');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.next.products[0].quantity).toBe(6);
    expect(plan.next.products[0].reservedQuantity).toBe(2);
  });
});
