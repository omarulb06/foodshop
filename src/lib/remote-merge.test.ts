import { mergeProducts } from '@/lib/remote-merge';
import type { Product, SyncOp } from '@/types';

function product(id: string, quantity: number, updatedAt: string): Product {
  return {
    id,
    name: id,
    unit: 'יחידות',
    unitId: 'pieces',
    quantity,
    reservedQuantity: 0,
    minStockLimit: 5,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('mergeProducts', () => {
  it('keeps a newer local quantity over a stale snapshot', () => {
    const local = [product('milk', 6, '2026-10-02T12:00:00.000Z')];
    const remote = [product('milk', 10, '2026-10-02T08:00:00.000Z')];
    const merged = mergeProducts(local, remote, [], true);
    expect(merged[0].quantity).toBe(6);
  });

  it('does not resurrect a product whose delete is still queued', () => {
    const remote = [product('milk', 10, '2026-10-02T12:00:00.000Z')];
    const outbox: SyncOp[] = [{ id: '1', kind: 'delete-product', productId: 'milk' }];
    expect(mergeProducts([], remote, outbox, true)).toEqual([]);
  });

  it('drops local-only products once a server snapshot is trusted', () => {
    const local = [product('sample', 1, '2026-10-01T00:00:00.000Z')];
    const remote = [product('real', 4, '2026-10-02T00:00:00.000Z')];
    const merged = mergeProducts(local, remote, [], true);
    expect(merged.map((item) => item.id)).toEqual(['real']);
  });
});