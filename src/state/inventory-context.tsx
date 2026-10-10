import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { inventoryRepository } from '@/data/inventory-repository';
import { normalizeBarcode } from '@/lib/barcode';
import { copy } from '@/lib/copy';
import { InventoryError } from '@/lib/errors';
import { compareIntakes } from '@/lib/intake';
import { createId } from '@/lib/ids';
import { emptyInventory } from '@/lib/inventory-store';
import { compareOrders } from '@/lib/orders';
import { applyChange, formatQuantity, roundQuantity } from '@/lib/quantity';
import { draftOverflow, productsThatBecameLow } from '@/lib/stock';
import type {
  HistoryEntry,
  InventoryData,
  IntakeItem,
  Order,
  OrderItem,
  Product,
  SupplierIntake,
  StockChangeInput,
  SyncState,
  UnitId,
} from '@/types';

export { InventoryError } from '@/lib/errors';

export interface AddProductInput {
  name: string;
  unit: string;
  unitId: UnitId;
  quantity: number;
  minStockLimit: number;
  actor: string;
  note?: string;
  /** When set, the product id is this barcode instead of a generated SKU. */
  barcode?: string;
}

export interface EditProductInput {
  name: string;
  unit: string;
  unitId: UnitId;
  minStockLimit: number;
}

export interface DraftOrderInput {
  customerName: string;
  items: OrderItem[];
}

export interface DraftIntakeInput {
  supplierName: string;
  items: IntakeItem[];
}

interface InventoryContextValue {
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  sync: SyncState;
  /** Alphabetical, which is the order every list in the app uses. */
  products: Product[];
  /** Newest first. */
  history: HistoryEntry[];
  /** Newest first. */
  orders: Order[];
  /** Newest first. */
  intakes: SupplierIntake[];
  lastActor: string;
  retryLoad: () => void;
  retrySync: () => void;
  getProduct: (productId: string) => Product | undefined;
  getOrder: (orderId: string) => Order | undefined;
  getIntake: (deliveryId: string) => SupplierIntake | undefined;
  getProductHistory: (productId: string) => HistoryEntry[];
  fetchProduct: (productId: string) => Promise<Product | null>;
  addProduct: (input: AddProductInput) => Promise<Product>;
  editProduct: (productId: string, input: EditProductInput) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveStockChanges: (input: { actor: string; changes: StockChangeInput[] }) => Promise<number>;
  saveDraftOrder: (input: DraftOrderInput, orderId?: string) => Promise<Order>;
  deleteDraftOrder: (orderId: string) => Promise<void>;
  addProductToLatestDraft: (product: Product) => Promise<Order | null>;
  approveDelivery: (orderId: string) => Promise<void>;
  saveDraftIntake: (input: DraftIntakeInput, deliveryId?: string) => Promise<SupplierIntake>;
  deleteDraftIntake: (deliveryId: string) => Promise<void>;
  receiveIntake: (deliveryId: string) => Promise<void>;
  stockAlert: string | null;
  dismissStockAlert: () => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

function byName(a: Product, b: Product): number {
  return a.name.localeCompare(b.name, 'he', { sensitivity: 'base' });
}

function byNewest(a: HistoryEntry, b: HistoryEntry): number {
  const difference = new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  return difference !== 0 ? difference : b.id.localeCompare(a.id);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof InventoryError) return error.message;
  if (error instanceof Error && error.message) return `${fallback} (${error.message})`;
  return fallback;
}

function draftItems(items: OrderItem[]): OrderItem[] {
  return items
    .map((item) => ({
      ...item,
      productName: item.productName.trim(),
      quantity: roundQuantity(item.quantity),
      price: roundQuantity(item.price),
    }))
    .filter((item) => item.productId && item.productName && item.quantity > 0 && item.price >= 0);
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InventoryData>(emptyInventory);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({ mode: 'synced', message: null });
  const [stockAlert, setStockAlert] = useState<string | null>(null);
  const dataRef = useRef(data);
  const lowStockBaseline = useRef<Product[] | null>(null);

  useEffect(() => {
    return inventoryRepository.subscribe((snapshot) => {
      dataRef.current = snapshot.data;
      setData(snapshot.data);
      setSync(snapshot.sync);
      if (!snapshot.ready) {
        setStatus('loading');
        return;
      }
      setLoadError(snapshot.loadError);
      setStatus(snapshot.loadError ? 'error' : 'ready');
    });
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    if (!lowStockBaseline.current) {
      lowStockBaseline.current = data.products;
      return;
    }
    const names = productsThatBecameLow(lowStockBaseline.current, data.products);
    lowStockBaseline.current = data.products;
    if (names.length > 0) setStockAlert(copy.lowStockToast(names));
  }, [data.products, status]);

  const dismissStockAlert = useCallback(() => setStockAlert(null), []);

  const commit = useCallback(async (next: InventoryData) => {
    await inventoryRepository.save(next);
  }, []);

  const products = useMemo(() => [...data.products].sort(byName), [data.products]);
  const history = useMemo(() => [...data.history].sort(byNewest), [data.history]);
  const orders = useMemo(() => [...data.orders].sort(compareOrders), [data.orders]);
  const intakes = useMemo(() => [...data.intakes].sort(compareIntakes), [data.intakes]);

  const getProduct = useCallback(
    (productId: string) => data.products.find((product) => product.id === productId),
    [data.products]
  );

  const getOrder = useCallback(
    (orderId: string) => data.orders.find((order) => order.orderId === orderId),
    [data.orders]
  );

  const getIntake = useCallback(
    (deliveryId: string) => data.intakes.find((intake) => intake.deliveryId === deliveryId),
    [data.intakes]
  );

  const getProductHistory = useCallback(
    (productId: string) => history.filter((entry) => entry.productId === productId),
    [history]
  );

  const addProduct = useCallback(
    async (input: AddProductInput) => {
      const current = dataRef.current;
      const name = input.name.trim();
      const unit = input.unit.trim();
      const actor = input.actor.trim();
      const barcode = input.barcode?.trim() ? normalizeBarcode(input.barcode) : null;

      if (input.barcode?.trim() && !barcode) throw new InventoryError(copy.invalidBarcode);
      if (!name) throw new InventoryError(copy.nameRequired);
      if (!unit) throw new InventoryError(copy.unitRequired);
      if (!actor) throw new InventoryError(copy.actorRequired);
      if (current.products.some((product) => product.name.toLowerCase() === name.toLowerCase())) {
        throw new InventoryError(copy.duplicateName(name));
      }
      if (barcode && current.products.some((product) => product.id === barcode)) {
        throw new InventoryError(copy.duplicateBarcode);
      }

      const savedAt = new Date().toISOString();
      const quantity = roundQuantity(input.quantity);
      const product: Product = {
        id: barcode ?? createId('product'),
        name,
        unit,
        unitId: input.unitId,
        quantity,
        reservedQuantity: 0,
        minStockLimit: input.minStockLimit,
        createdAt: savedAt,
        updatedAt: savedAt,
      };
      const note = input.note?.trim();
      const entry: HistoryEntry = {
        id: createId('entry'),
        batchId: createId('batch'),
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        kind: 'create',
        changeType: 'MANUAL_ADJUST',
        quantityBefore: 0,
        quantityAfter: quantity,
        delta: quantity,
        ...(note ? { note } : {}),
        actor,
        savedAt,
      };

      await commit({
        ...current,
        products: [...current.products, product],
        history: [...current.history, entry],
        lastActor: actor,
      });

      return product;
    },
    [commit]
  );

  const editProduct = useCallback(
    async (productId: string, input: EditProductInput) => {
      const current = dataRef.current;
      const existing = current.products.find((product) => product.id === productId);
      if (!existing) throw new InventoryError(copy.productGoneTitle);

      const name = input.name.trim();
      const unit = input.unit.trim();
      if (!name) throw new InventoryError(copy.nameRequired);
      if (!unit) throw new InventoryError(copy.unitRequired);
      if (
        current.products.some(
          (product) => product.id !== productId && product.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        throw new InventoryError(copy.duplicateName(name));
      }

      await commit({
        ...current,
        products: current.products.map((product) =>
          product.id === productId
            ? {
                ...product,
                name,
                unit,
                unitId: input.unitId,
                minStockLimit: input.minStockLimit,
                updatedAt: new Date().toISOString(),
              }
            : product
        ),
      });
    },
    [commit]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      const current = dataRef.current;
      const existing = current.products.find((product) => product.id === productId);
      const held = current.orders.some(
        (order) =>
          order.status === 'DRAFT' && order.items.some((item) => item.productId === productId)
      );
      if (held) {
        throw new InventoryError(copy.productReserved(existing?.name ?? copy.unknownProduct));
      }
      await commit({
        ...current,
        products: current.products.filter((product) => product.id !== productId),
        history: current.history.filter((entry) => entry.productId !== productId),
      });
    },
    [commit]
  );

  const saveStockChanges = useCallback(
    async ({ actor, changes }: { actor: string; changes: StockChangeInput[] }) => {
      const current = dataRef.current;
      const trimmedActor = actor.trim();
      if (!trimmedActor) throw new InventoryError(copy.actorSavingRequired);
      if (changes.length === 0) throw new InventoryError(copy.noChanges);

      const savedAt = new Date().toISOString();
      const batchId = createId('batch');
      const quantities = new Map(current.products.map((product) => [product.id, product.quantity]));
      const entries: HistoryEntry[] = [];

      for (const change of changes) {
        const product = current.products.find((item) => item.id === change.productId);
        if (!product) throw new InventoryError(copy.productRemovedWhileEditing);

        const quantityBefore = quantities.get(product.id) ?? product.quantity;
        const quantityAfter = applyChange(quantityBefore, change.mode, change.amount);
        if (quantityAfter === quantityBefore) continue;
        if (quantityAfter < product.reservedQuantity) {
          throw new InventoryError(
            copy.stockReserved(product.name, formatQuantity(product.reservedQuantity))
          );
        }

        quantities.set(product.id, quantityAfter);
        const note = change.note?.trim();
        entries.push({
          id: createId('entry'),
          batchId,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          kind: change.mode,
          changeType: 'MANUAL_ADJUST',
          quantityBefore,
          quantityAfter,
          delta: roundQuantity(quantityAfter - quantityBefore),
          ...(note ? { note } : {}),
          actor: trimmedActor,
          savedAt,
        });
      }

      if (entries.length === 0) throw new InventoryError(copy.noChanges);

      await commit({
        ...current,
        products: current.products.map((product) => {
          const quantity = quantities.get(product.id);
          return quantity !== undefined && quantity !== product.quantity
            ? { ...product, quantity, updatedAt: savedAt }
            : product;
        }),
        history: [...current.history, ...entries],
        lastActor: trimmedActor,
      });

      return entries.length;
    },
    [commit]
  );

  const saveDraftOrder = useCallback(
    async (input: DraftOrderInput, orderId?: string) => {
      const current = dataRef.current;
      const customerName = input.customerName.trim();
      const items = draftItems(input.items);
      if (!customerName) throw new InventoryError(copy.customerRequired);
      if (items.length === 0) throw new InventoryError(copy.orderNeedsItems);

      const now = new Date().toISOString();
      const existing = orderId ? current.orders.find((order) => order.orderId === orderId) : undefined;
      if (orderId && !existing) throw new InventoryError(copy.orderMissing);
      if (existing && existing.status !== 'DRAFT') throw new InventoryError(copy.orderAlreadyDelivered);

      const overflow = draftOverflow(current, items, existing?.orderId);
      if (overflow) {
        throw new InventoryError(
          copy.notEnoughAvailable(
            overflow.name,
            formatQuantity(overflow.available),
            formatQuantity(overflow.requested)
          )
        );
      }

      const order: Order = {
        orderId: existing?.orderId ?? createId('order'),
        customerName,
        items,
        status: 'DRAFT',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deliveredAt: null,
      };

      await commit({
        ...current,
        orders: existing
          ? current.orders.map((item) => (item.orderId === order.orderId ? order : item))
          : [...current.orders, order],
      });
      return order;
    },
    [commit]
  );

  const deleteDraftOrder = useCallback(
    async (orderId: string) => {
      const current = dataRef.current;
      const existing = current.orders.find((order) => order.orderId === orderId);
      if (!existing) throw new InventoryError(copy.orderMissing);
      if (existing.status !== 'DRAFT') throw new InventoryError(copy.orderAlreadyDelivered);
      await commit({
        ...current,
        orders: current.orders.filter((order) => order.orderId !== orderId),
      });
    },
    [commit]
  );

  const addProductToLatestDraft = useCallback(
    async (product: Product) => {
      const current = dataRef.current;
      const draft = [...current.orders]
        .filter((order) => order.status === 'DRAFT')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      if (!draft) return null;

      const items = draft.items.map((item) => ({ ...item }));
      const line = items.find((item) => item.productId === product.id);
      if (line) line.quantity = roundQuantity(line.quantity + 1);
      else {
        items.push({
          productId: product.id,
          productName: product.name,
          quantity: 1,
          price: 0,
        });
      }

      const order: Order = { ...draft, items, updatedAt: new Date().toISOString() };
      const overflow = draftOverflow(current, items, order.orderId);
      if (overflow) {
        throw new InventoryError(
          copy.notEnoughAvailable(
            overflow.name,
            formatQuantity(overflow.available),
            formatQuantity(overflow.requested)
          )
        );
      }
      await commit({
        ...current,
        orders: current.orders.map((item) => (item.orderId === order.orderId ? order : item)),
      });
      return order;
    },
    [commit]
  );

  const approveDelivery = useCallback(async (orderId: string) => {
    await inventoryRepository.approveDelivery(orderId);
  }, []);

  const saveDraftIntake = useCallback(
    async (input: DraftIntakeInput, deliveryId?: string) => {
      const current = dataRef.current;
      const supplierName = input.supplierName.trim();
      const items = input.items
        .map((item) => ({
          ...item,
          productName: item.productName.trim(),
          addedQuantity: roundQuantity(item.addedQuantity),
          unitCost: roundQuantity(item.unitCost),
        }))
        .filter((item) => item.productId && item.productName && item.addedQuantity > 0 && item.unitCost >= 0);
      if (items.length === 0) throw new InventoryError(copy.intakeNeedsItems);

      const now = new Date().toISOString();
      const existing = deliveryId ? current.intakes.find((item) => item.deliveryId === deliveryId) : undefined;
      if (deliveryId && !existing) throw new InventoryError(copy.intakeMissing);
      if (existing && existing.status !== 'DRAFT') throw new InventoryError(copy.intakeAlreadyReceived);

      const intake: SupplierIntake = {
        deliveryId: existing?.deliveryId ?? createId('delivery'),
        supplierName,
        items,
        status: 'DRAFT',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        receivedAt: null,
      };

      await commit({
        ...current,
        intakes: existing
          ? current.intakes.map((item) => (item.deliveryId === intake.deliveryId ? intake : item))
          : [...current.intakes, intake],
      });
      return intake;
    },
    [commit]
  );

  const deleteDraftIntake = useCallback(
    async (deliveryId: string) => {
      const current = dataRef.current;
      const existing = current.intakes.find((item) => item.deliveryId === deliveryId);
      if (!existing) throw new InventoryError(copy.intakeMissing);
      if (existing.status !== 'DRAFT') throw new InventoryError(copy.intakeAlreadyReceived);
      await commit({
        ...current,
        intakes: current.intakes.filter((item) => item.deliveryId !== deliveryId),
      });
    },
    [commit]
  );

  const receiveIntake = useCallback(async (deliveryId: string) => {
    await inventoryRepository.receiveIntake(deliveryId);
  }, []);

  const value = useMemo<InventoryContextValue>(
    () => ({
      status,
      loadError,
      sync,
      products,
      history,
      orders,
      intakes,
      lastActor: data.lastActor,
      retryLoad: () => {
        void inventoryRepository.retryLoad();
      },
      retrySync: () => {
        void inventoryRepository.retrySync();
      },
      getProduct,
      getOrder,
      getIntake,
      getProductHistory,
      fetchProduct: (productId: string) => inventoryRepository.fetchProduct(productId),
      addProduct,
      editProduct,
      deleteProduct,
      saveStockChanges,
      saveDraftOrder,
      deleteDraftOrder,
      addProductToLatestDraft,
      approveDelivery,
      saveDraftIntake,
      deleteDraftIntake,
      receiveIntake,
      stockAlert,
      dismissStockAlert,
    }),
    [
      status,
      loadError,
      sync,
      products,
      history,
      orders,
      intakes,
      data.lastActor,
      getProduct,
      getOrder,
      getIntake,
      getProductHistory,
      addProduct,
      editProduct,
      deleteProduct,
      saveStockChanges,
      saveDraftOrder,
      deleteDraftOrder,
      addProductToLatestDraft,
      approveDelivery,
      saveDraftIntake,
      deleteDraftIntake,
      receiveIntake,
      stockAlert,
      dismissStockAlert,
    ]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used inside an InventoryProvider.');
  }
  return context;
}

export function inventoryErrorMessage(error: unknown, fallback: string): string {
  return errorMessage(error, fallback);
}
