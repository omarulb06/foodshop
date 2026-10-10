import { SQLiteStorage } from 'expo-sqlite/kv-store';

import { copy } from '@/lib/copy';
import { roundQuantity } from '@/lib/quantity';
import { applyReservations, DEFAULT_MIN_STOCK } from '@/lib/stock';
import type {
  ChangeKind,
  HistoryEntry,
  InventoryData,
  IntakeItem,
  IntakeStatus,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  StockChangeType,
  SupplierIntake,
  SyncOp,
  SyncOpKind,
  UnitId,
} from '@/types';

/**
 * Named explicitly rather than using the shared default store, so the data sits
 * in a file of our own: files/SQLite/food-shop-inventory.db inside the app's
 * private Android storage.
 */
const storage = new SQLiteStorage('food-shop-inventory.db');

/**
 * The whole inventory lives under a single key. One `setItem` therefore stores
 * the quantity changes and their history records together, which is what makes
 * a failed save leave the data exactly as it was.
 */
const STORAGE_KEY = 'food-shop-inventory/v1';

export const SCHEMA_VERSION = 2;

export function emptyInventory(): InventoryData {
  return {
    schemaVersion: SCHEMA_VERSION,
    products: [],
    history: [],
    orders: [],
    intakes: [],
    lastActor: '',
    outbox: [],
    cloudSeeded: false,
  };
}

const UNIT_IDS: UnitId[] = ['pieces', 'packs', 'boxes', 'bottles', 'kg', 'custom'];
const CHANGE_KINDS: ChangeKind[] = ['create', 'add', 'remove', 'set'];
const CHANGE_TYPES: StockChangeType[] = ['ORDER_DELIVERED', 'MANUAL_ADJUST', 'SUPPLIER_DELIVERY'];
const INTAKE_STATUSES: IntakeStatus[] = ['DRAFT', 'RECEIVED_COMPLETED'];
const ORDER_STATUSES: OrderStatus[] = ['DRAFT', 'APPROVED_DELIVERED'];
const SYNC_KINDS: SyncOpKind[] = [
  'upsert-product',
  'delete-product',
  'append-history',
  'settings',
  'upsert-order',
  'delete-order',
  'upsert-intake',
  'delete-intake',
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asQuantity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? roundQuantity(value) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProduct(raw: unknown): Product | null {
  if (!isRecord(raw)) return null;

  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) return null;

  const unitId = UNIT_IDS.includes(raw.unitId as UnitId) ? (raw.unitId as UnitId) : 'pieces';
  const createdAt = asString(raw.createdAt, new Date().toISOString());

  return {
    id,
    name,
    unit: asString(raw.unit, 'pieces') || 'pieces',
    unitId,
    quantity: Math.max(0, asQuantity(raw.quantity)),
    reservedQuantity: Math.max(0, asQuantity(raw.reservedQuantity)),
    minStockLimit:
      raw.minStockLimit === undefined || raw.minStockLimit === null
        ? DEFAULT_MIN_STOCK
        : Math.max(0, asQuantity(raw.minStockLimit)),
    createdAt,
    updatedAt: asString(raw.updatedAt, createdAt),
  };
}

function parseEntry(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw)) return null;

  const id = asString(raw.id);
  const productId = asString(raw.productId);
  const savedAt = asString(raw.savedAt) || asString(raw.timestamp);
  if (!id || !productId || !savedAt) return null;

  const quantityAfter = raw.quantityAfter === undefined ? asQuantity(raw.newQuantity) : asQuantity(raw.quantityAfter);
  const delta =
    typeof raw.delta === 'number'
      ? roundQuantity(raw.delta)
      : typeof raw.amountChanged === 'number'
        ? roundQuantity(raw.amountChanged)
        : roundQuantity(quantityAfter - asQuantity(raw.quantityBefore));
  const quantityBefore =
    raw.quantityBefore === undefined ? roundQuantity(quantityAfter - delta) : asQuantity(raw.quantityBefore);
  const changeType = CHANGE_TYPES.includes(raw.changeType as StockChangeType)
    ? (raw.changeType as StockChangeType)
    : 'MANUAL_ADJUST';
  const note = asString(raw.note);

  return {
    id,
    batchId: asString(raw.batchId, id),
    productId,
    productName: asString(raw.productName, copy.unknownProduct),
    unit: asString(raw.unit),
    kind: CHANGE_KINDS.includes(raw.kind as ChangeKind)
      ? (raw.kind as ChangeKind)
      : changeType === 'ORDER_DELIVERED'
        ? 'remove'
        : 'set',
    changeType,
    quantityBefore,
    quantityAfter,
    delta,
    ...(note ? { note } : {}),
    actor: asString(raw.actor, 'Unknown'),
    savedAt,
  };
}

function parseOrderItem(raw: unknown): OrderItem | null {
  if (!isRecord(raw)) return null;
  const productId = asString(raw.productId);
  const productName = asString(raw.productName);
  if (!productId || !productName) return null;
  const quantity = asQuantity(raw.quantity);
  const price = asQuantity(raw.price);
  if (quantity <= 0 || price < 0) return null;
  return { productId, productName, quantity, price };
}

function parseOrder(raw: unknown): Order | null {
  if (!isRecord(raw)) return null;
  const orderId = asString(raw.orderId);
  const customerName = asString(raw.customerName);
  const createdAt = asString(raw.createdAt);
  if (!orderId || !customerName || !createdAt) return null;
  if (!ORDER_STATUSES.includes(raw.status as OrderStatus)) return null;

  const items = Array.isArray(raw.items)
    ? raw.items.map(parseOrderItem).filter((item): item is OrderItem => item !== null)
    : [];
  if (items.length === 0) return null;

  const deliveredAt = asString(raw.deliveredAt);
  return {
    orderId,
    customerName,
    items,
    status: raw.status as OrderStatus,
    createdAt,
    updatedAt: asString(raw.updatedAt, createdAt),
    deliveredAt: deliveredAt ? deliveredAt : null,
  };
}

function parseIntakeItem(raw: unknown): IntakeItem | null {
  if (!isRecord(raw)) return null;
  const productId = asString(raw.productId);
  const productName = asString(raw.productName);
  if (!productId || !productName) return null;
  const addedQuantity = asQuantity(raw.addedQuantity);
  const unitCost = asQuantity(raw.unitCost);
  if (addedQuantity <= 0 || unitCost < 0) return null;
  return { productId, productName, addedQuantity, unitCost };
}

function parseIntake(raw: unknown): SupplierIntake | null {
  if (!isRecord(raw)) return null;
  const deliveryId = asString(raw.deliveryId);
  const createdAt = asString(raw.createdAt);
  if (!deliveryId || !createdAt) return null;
  if (!INTAKE_STATUSES.includes(raw.status as IntakeStatus)) return null;
  const items = Array.isArray(raw.items)
    ? raw.items.map(parseIntakeItem).filter((item): item is IntakeItem => item !== null)
    : [];
  if (items.length === 0) return null;
  const receivedAt = asString(raw.receivedAt);
  return {
    deliveryId,
    supplierName: asString(raw.supplierName),
    items,
    status: raw.status as IntakeStatus,
    createdAt,
    updatedAt: asString(raw.updatedAt, createdAt),
    receivedAt: receivedAt ? receivedAt : null,
  };
}

function parseSyncOp(raw: unknown): SyncOp | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id || !SYNC_KINDS.includes(raw.kind as SyncOpKind)) return null;
  const entryIds = Array.isArray(raw.entryIds)
    ? raw.entryIds.filter((entryId): entryId is string => typeof entryId === 'string' && entryId.length > 0)
    : undefined;
  return {
    id,
    kind: raw.kind as SyncOpKind,
    ...(asString(raw.productId) ? { productId: asString(raw.productId) } : {}),
    ...(asString(raw.orderId) ? { orderId: asString(raw.orderId) } : {}),
    ...(asString(raw.deliveryId) ? { deliveryId: asString(raw.deliveryId) } : {}),
    ...(entryIds && entryIds.length > 0 ? { entryIds } : {}),
  };
}

/**
 * Rebuilds the stored document field by field. A half written or hand edited
 * file then degrades into whatever is still readable instead of crashing.
 */
export function normalizeInventory(
  raw: unknown,
  options?: { keepOrphanHistory?: boolean }
): InventoryData | null {
  if (!isRecord(raw)) return null;

  const products = Array.isArray(raw.products)
    ? raw.products.map(parseProduct).filter((item): item is Product => item !== null)
    : [];
  const knownIds = new Set(products.map((product) => product.id));
  const history = Array.isArray(raw.history)
    ? raw.history
        .map(parseEntry)
        .filter(
          (item): item is HistoryEntry =>
            item !== null && (options?.keepOrphanHistory === true || knownIds.has(item.productId))
        )
    : [];

  const orders = Array.isArray(raw.orders)
    ? raw.orders.map(parseOrder).filter((item): item is Order => item !== null)
    : [];
  const intakes = Array.isArray(raw.intakes)
    ? raw.intakes.map(parseIntake).filter((item): item is SupplierIntake => item !== null)
    : [];
  const outbox = Array.isArray(raw.outbox)
    ? raw.outbox.map(parseSyncOp).filter((item): item is SyncOp => item !== null)
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    products,
    history,
    orders,
    intakes,
    lastActor: asString(raw.lastActor),
    outbox,
    cloudSeeded: raw.cloudSeeded === true,
  };
}

/** `null` means nothing has ever been stored, which is how a first launch is detected. */
export async function loadInventory(): Promise<InventoryData | null> {
  const stored = await storage.getItemAsync(STORAGE_KEY);
  if (stored === null) {
    return null;
  }
  const data = normalizeInventory(JSON.parse(stored) as unknown);
  return data ? applyReservations(data) : null;
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** Writes are chained so two quick saves cannot interleave and lose records. */
export function saveInventory(data: InventoryData): Promise<void> {
  const payload = JSON.stringify({ ...data, schemaVersion: SCHEMA_VERSION });
  const write = writeQueue
    .catch(() => undefined)
    .then(() => storage.setItemAsync(STORAGE_KEY, payload));

  writeQueue = write.catch(() => undefined);
  return write;
}
