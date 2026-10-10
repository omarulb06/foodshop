/** Identifier of one of the units offered when creating a product. */
export type UnitId = 'pieces' | 'packs' | 'boxes' | 'bottles' | 'kg' | 'custom';

export interface Product {
  /** SKU. When the product was created from a scan, this is the barcode value. */
  id: string;
  name: string;
  /** Label shown in the interface, for example "יחידות", "ק״ג" or a custom word. */
  unit: string;
  unitId: UnitId;
  /** On-hand stock. Kilograms may be fractional; other units are whole numbers. */
  quantity: number;
  /** Quantity locked by draft orders. Available stock is quantity minus this. */
  reservedQuantity: number;
  /** Available stock at or below this value is marked as low. */
  minStockLimit: number;
  createdAt: string;
  /** Mirrors the Firestore `lastUpdated` timestamp. */
  updatedAt: string;
}

/** Stored in Firestore as these exact codes. The Hebrew labels live in the UI. */
export type OrderStatus = 'DRAFT' | 'APPROVED_DELIVERED';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}

/** Stored in Firestore as these exact codes. The Hebrew labels live in the UI. */
export type IntakeStatus = 'DRAFT' | 'RECEIVED_COMPLETED';

export interface IntakeItem {
  productId: string;
  productName: string;
  addedQuantity: number;
  unitCost: number;
}

/** A supplier shipment. Drafts do not change stock until they are received. */
export interface SupplierIntake {
  deliveryId: string;
  supplierName: string;
  items: IntakeItem[];
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
}

export type SyncOpKind =
  | 'upsert-product'
  | 'delete-product'
  | 'append-history'
  | 'settings'
  | 'upsert-order'
  | 'delete-order'
  | 'upsert-intake'
  | 'delete-intake';

/** A local change that still needs to be written to Firestore. */
export interface SyncOp {
  id: string;
  kind: SyncOpKind;
  productId?: string;
  orderId?: string;
  deliveryId?: string;
  entryIds?: string[];
}

/**
 * `create` records that a product was added to the shop.
 * `add` / `remove` / `set` record the three ways stock can be changed.
 */
export type ChangeKind = 'create' | 'add' | 'remove' | 'set';

/** Stored on each history document. Delivery is separate from a hand count. */
export type StockChangeType = 'ORDER_DELIVERED' | 'MANUAL_ADJUST' | 'SUPPLIER_DELIVERY';

export interface HistoryEntry {
  id: string;
  /** Shared by every entry written by a single "Save all changes" action. */
  batchId: string;
  productId: string;
  /** Name of the product when the change was saved, kept as a fallback. */
  productName: string;
  unit: string;
  kind: ChangeKind;
  changeType: StockChangeType;
  quantityBefore: number;
  /** Stock after this change. Written to Firestore as `newQuantity`. */
  quantityAfter: number;
  /** Signed change. Written to Firestore as `amountChanged`. */
  delta: number;
  note?: string;
  actor: string;
  savedAt: string;
}

export interface InventoryData {
  schemaVersion: number;
  products: Product[];
  history: HistoryEntry[];
  orders: Order[];
  /** Supplier shipments waiting to be received, or already received. */
  intakes: SupplierIntake[];
  /** Last name typed into a "Saved by" field, used to prefill the next one. */
  lastActor: string;
  /** Writes waiting for Firestore. Empty when the cloud matches this device. */
  outbox: SyncOp[];
  /** Set after this install has successfully read the server at least once. */
  cloudSeeded: boolean;
}

export type SyncMode = 'local-only' | 'synced' | 'offline' | 'pending' | 'error';

export interface SyncState {
  mode: SyncMode;
  message: string | null;
}

export type StockChangeMode = 'add' | 'remove' | 'set';

export interface StockChangeInput {
  productId: string;
  mode: StockChangeMode;
  amount: number;
  note?: string;
}
