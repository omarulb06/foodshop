import { normalizeInventory } from '@/lib/inventory-store';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  SQLiteStorage: class {
    getItemAsync = jest.fn();
    setItemAsync = jest.fn();
  },
}));

describe('normalizeInventory', () => {
  it('rejects anything that is not an object', () => {
    expect(normalizeInventory(null)).toBeNull();
    expect(normalizeInventory('broken')).toBeNull();
  });

  it('keeps valid products and drops unusable ones', () => {
    const result = normalizeInventory({
      products: [
        { id: 'p1', name: 'Eggs', unit: 'pieces', unitId: 'pieces', quantity: 12 },
        { id: '', name: 'Nameless' },
        'not a product',
      ],
      history: [],
    });

    expect(result?.products).toHaveLength(1);
    expect(result?.products[0].name).toBe('Eggs');
  });

  it('replaces an unknown unit and clamps a negative quantity', () => {
    const result = normalizeInventory({
      products: [{ id: 'p1', name: 'Eggs', unit: 'pieces', unitId: 'barrels', quantity: -5 }],
      history: [],
    });

    expect(result?.products[0].unitId).toBe('pieces');
    expect(result?.products[0].quantity).toBe(0);
  });

  it('drops history that belongs to a product that no longer exists', () => {
    const result = normalizeInventory({
      products: [{ id: 'p1', name: 'Eggs', unit: 'pieces', unitId: 'pieces', quantity: 12 }],
      history: [
        {
          id: 'e1',
          batchId: 'b1',
          productId: 'p1',
          productName: 'Eggs',
          unit: 'pieces',
          kind: 'add',
          quantityBefore: 10,
          quantityAfter: 12,
          delta: 2,
          actor: 'Sam',
          savedAt: '2026-10-08T10:00:00.000Z',
        },
        {
          id: 'e2',
          batchId: 'b1',
          productId: 'deleted-product',
          productName: 'Gone',
          unit: 'kg',
          kind: 'add',
          quantityBefore: 0,
          quantityAfter: 1,
          delta: 1,
          actor: 'Sam',
          savedAt: '2026-10-08T10:00:00.000Z',
        },
      ],
    });

    expect(result?.history.map((entry) => entry.id)).toEqual(['e1']);
  });

  it('recalculates a missing delta from the stored quantities', () => {
    const result = normalizeInventory({
      products: [{ id: 'p1', name: 'Eggs', unit: 'pieces', unitId: 'pieces', quantity: 12 }],
      history: [
        {
          id: 'e1',
          batchId: 'b1',
          productId: 'p1',
          productName: 'Eggs',
          unit: 'pieces',
          kind: 'add',
          quantityBefore: 10,
          quantityAfter: 12,
          actor: 'Sam',
          savedAt: '2026-10-08T10:00:00.000Z',
        },
      ],
    });

    expect(result?.history[0].delta).toBe(2);
  });
});
