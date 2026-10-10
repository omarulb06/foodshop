import { applyReservations, availableQuantity, draftOverflow, isLowStock, productsThatBecameLow } from '@/lib/stock';
import type { InventoryData, Order, Product } from '@/types';

function product(id: string, quantity: number, reservedQuantity = 0, minStockLimit = 5): Product {
  return {
    id,
    name: id,
    unit: 'יחידות',
    unitId: 'pieces',
    quantity,
    reservedQuantity,
    minStockLimit,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function draft(orderId: string, productId: string, quantity: number, status: Order['status'] = 'DRAFT'): Order {
  return {
    orderId,
    customerName: 'לקוח',
    items: [{ productId, productName: productId, quantity, price: 1 }],
    status,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    deliveredAt: status === 'APPROVED_DELIVERED' ? '2026-10-02T00:00:00.000Z' : null,
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

describe('reservations', () => {
  it('locks the sum of draft lines and ignores a delivered order', () => {
    const data = applyReservations(
      inventory(
        [product('milk', 10)],
        [draft('a', 'milk', 3), draft('b', 'milk', 2), draft('c', 'milk', 4, 'APPROVED_DELIVERED')]
      )
    );
    expect(data.products[0].reservedQuantity).toBe(5);
    expect(availableQuantity(data.products[0])).toBe(5);
  });

  it('releases a reservation when that draft is removed', () => {
    const held = applyReservations(inventory([product('milk', 10)], [draft('a', 'milk', 3), draft('b', 'milk', 2)]));
    const released = applyReservations({
      ...held,
      orders: held.orders.filter((order) => order.orderId !== 'a'),
    });
    expect(released.products[0].reservedQuantity).toBe(2);
    expect(availableQuantity(released.products[0])).toBe(8);
  });

  it('refuses a draft that asks for more than the free stock', () => {
    const data = applyReservations(inventory([product('חלב', 10)], [draft('a', 'חלב', 8)]));
    const overflow = draftOverflow(
      data,
      [{ productId: 'חלב', productName: 'חלב', quantity: 3, price: 0 }],
      'new'
    );
    expect(overflow?.name).toBe('חלב');
    expect(overflow?.available).toBe(2);
  });

  it('lets an edited draft keep the quantity it already reserved', () => {
    const data = applyReservations(inventory([product('חלב', 10)], [draft('a', 'חלב', 8)]));
    const overflow = draftOverflow(
      data,
      [{ productId: 'חלב', productName: 'חלב', quantity: 9, price: 0 }],
      'a'
    );
    expect(overflow).toBeNull();
  });
});

describe('low stock', () => {
  it('marks a product when available stock is at the limit', () => {
    expect(isLowStock(product('milk', 8, 3, 5))).toBe(true);
    expect(isLowStock(product('milk', 8, 2, 5))).toBe(false);
  });

  it('names only products that crossed the limit', () => {
    const before = [product('milk', 10, 0, 5), product('rice', 2, 0, 5)];
    const after = [product('milk', 4, 0, 5), product('rice', 2, 0, 5)];
    expect(productsThatBecameLow(before, after)).toEqual(['milk']);
  });
});
