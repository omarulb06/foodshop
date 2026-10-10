import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import {
  firestoreCode,
  getDb,
  isOfflineError,
  mapFirestoreError,
  withTimeout,
} from '@/data/firestore-client';
import { isFirebaseConfigured } from '@/data/firebase-config';
import { runDeliveryTransaction } from '@/data/delivery-transaction';
import { runIntakeTransaction } from '@/data/intake-transaction';
import {
  historyFromFirestore,
  historyToFirestore,
  intakeFromFirestore,
  intakeToFirestore,
  orderFromFirestore,
  orderToFirestore,
  productFromFirestore,
  productToFirestore,
} from '@/data/firestore-mappers';
import { copy } from '@/lib/copy';
import { applyDeliveryResult, planDelivery } from '@/lib/delivery';
import { applyIntakeResult, planReceive } from '@/lib/intake';
import { InventoryError } from '@/lib/errors';
import {
  emptyInventory,
  loadInventory,
  normalizeInventory,
  saveInventory,
  SCHEMA_VERSION,
} from '@/lib/inventory-store';
import { mergeIntakes, mergeOrders, mergeProducts } from '@/lib/remote-merge';
import { applyReservations } from '@/lib/stock';
import { coalesceOps, planSyncOps, type FlushOp } from '@/lib/sync-plan';
import type { HistoryEntry, InventoryData, Order, Product, SupplierIntake, SyncState } from '@/types';

const WRITE_CHUNK = 400;

export interface RepositorySnapshot {
  data: InventoryData;
  sync: SyncState;
  ready: boolean;
  loadError: string | null;
}

type Listener = (snapshot: RepositorySnapshot) => void;

/**
 * Local SQLite is the copy the screens read. Firestore is the shared database.
 * Edits land locally first, then the outbox is flushed. Delivery is the exception:
 * it runs a server transaction and only then updates the local copy.
 */
class InventoryRepository {
  private data: InventoryData = emptyInventory();
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private booted: Promise<void> | null = null;
  private unsubscribers: (() => void)[] = [];
  private ready = false;
  private loadError: string | null = null;
  private syncError: string | null = null;
  private offline = false;

  private remoteProducts: Product[] | null = null;
  private remoteOrders: Order[] | null = null;
  private remoteHistory: HistoryEntry[] | null = null;
  private remoteIntakes: SupplierIntake[] | null = null;
  private remoteActor: string | null = null;
  private sawProducts = false;
  private sawOrders = false;
  private sawHistory = false;
  private sawIntakes = false;
  private trustProducts = false;
  private trustOrders = false;
  private trustIntakes = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    void this.ensureBoot();
    return () => {
      this.listeners.delete(listener);
    };
  }

  async retryLoad(): Promise<void> {
    for (const stop of this.unsubscribers) stop();
    this.unsubscribers = [];
    this.ready = false;
    this.loadError = null;
    this.booted = null;
    this.sawProducts = false;
    this.sawOrders = false;
    this.sawHistory = false;
    this.sawIntakes = false;
    this.emit();
    await this.ensureBoot();
  }

  retrySync(): Promise<void> {
    this.syncError = null;
    this.emit();
    return this.flush();
  }

  async save(next: InventoryData): Promise<void> {
    await this.mutex(async () => {
      const adjusted = applyReservations(next);
      const ops = isFirebaseConfigured() ? planSyncOps(this.data, adjusted) : [];
      this.data = {
        ...adjusted,
        schemaVersion: SCHEMA_VERSION,
        outbox: [...this.data.outbox, ...ops],
        cloudSeeded: this.data.cloudSeeded,
      };
      await saveInventory(this.data);
      this.emit();
    });
    void this.flush();
  }

  async receiveIntake(deliveryId: string): Promise<void> {
    const actor = this.data.lastActor.trim() || copy.intakeActor;
    if (!isFirebaseConfigured()) {
      await this.mutex(async () => {
        const plan = planReceive(this.data, deliveryId, new Date().toISOString(), actor);
        if (!plan.ok) throw new InventoryError(plan.error);
        this.data = plan.next;
        await saveInventory(this.data);
        this.emit();
      });
      return;
    }

    await this.flush();
    await this.mutex(async () => {
      if (this.data.outbox.length > 0) throw new InventoryError(copy.intakeNeedsNetwork);
      const now = new Date().toISOString();
      const preview = planReceive(this.data, deliveryId, now, actor);
      if (!preview.ok) throw new InventoryError(preview.error);
      try {
        const result = await this.receiveWithRetry(deliveryId, actor, now);
        this.data = applyIntakeResult(this.data, result);
        await saveInventory(this.data);
        this.offline = false;
        this.syncError = null;
        this.emit();
      } catch (error) {
        if (error instanceof InventoryError) throw error;
        if (isOfflineError(error) || firestoreCode(error).includes('aborted')) {
          throw new InventoryError(copy.intakeNeedsNetwork);
        }
        throw new InventoryError(mapFirestoreError(error));
      }
    });
  }

  async approveDelivery(orderId: string): Promise<void> {
    const actor = this.data.lastActor.trim() || copy.deliveryActor;
    if (!isFirebaseConfigured()) {
      await this.mutex(async () => {
        const plan = planDelivery(this.data, orderId, new Date().toISOString(), actor);
        if (!plan.ok) throw new InventoryError(plan.error);
        this.data = plan.next;
        await saveInventory(this.data);
        this.emit();
      });
      return;
    }

    await this.flush();
    await this.mutex(async () => {
      if (this.data.outbox.length > 0) throw new InventoryError(copy.deliveryNeedsNetwork);
      const now = new Date().toISOString();
      const preview = planDelivery(this.data, orderId, now, actor);
      if (!preview.ok) throw new InventoryError(preview.error);
      try {
        const result = await this.deliverWithRetry(orderId, actor, now);
        this.data = applyDeliveryResult(this.data, result);
        await saveInventory(this.data);
        this.offline = false;
        this.syncError = null;
        this.emit();
      } catch (error) {
        if (error instanceof InventoryError) throw error;
        if (isOfflineError(error) || firestoreCode(error).includes('aborted')) {
          throw new InventoryError(copy.deliveryNeedsNetwork);
        }
        throw new InventoryError(mapFirestoreError(error));
      }
    });
  }

  /** Used by the scanner when the barcode is not in the on-device list yet. */
  async fetchProduct(id: string): Promise<Product | null> {
    const local = this.data.products.find((product) => product.id === id);
    if (local) return local;
    if (!isFirebaseConfigured()) return null;

    try {
      const ref = doc(getDb(), 'products', id);
      let snap;
      try {
        snap = await getDocFromServer(ref);
      } catch {
        snap = await getDoc(ref);
      }
      if (!snap.exists()) return null;
      const normalized = normalizeInventory({
        ...emptyInventory(),
        products: [productFromFirestore(snap.id, snap.data())],
      });
      const product = normalized?.products[0];
      if (!product) return null;
      await this.mutex(async () => {
        if (this.data.products.some((item) => item.id === product.id)) return;
        this.data = { ...this.data, products: [...this.data.products, product] };
        await saveInventory(this.data);
        this.emit();
      });
      return this.data.products.find((item) => item.id === product.id) ?? product;
    } catch {
      return null;
    }
  }

  private ensureBoot(): Promise<void> {
    if (!this.booted) {
      this.booted = this.boot().catch((error: unknown) => {
        this.booted = null;
        this.loadError = error instanceof Error ? error.message : copy.loadFailedBody;
        this.ready = true;
        this.emit();
      });
    }
    return this.booted;
  }

  private async boot(): Promise<void> {
    try {
      const stored = await loadInventory();
      this.data = stored ?? emptyInventory();
      if (!stored) await saveInventory(this.data);
      this.loadError = null;
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : copy.loadFailedBody;
      this.ready = true;
      this.emit();
      return;
    }

    this.ready = true;
    this.emit();

    if (!isFirebaseConfigured()) return;

    try {
      await this.migrate();
      await this.flush();
      this.listen();
    } catch (error) {
      if (isOfflineError(error)) this.offline = true;
      else this.syncError = mapFirestoreError(error);
      this.emit();
    }
  }

  private async migrate(): Promise<void> {
    if (this.data.cloudSeeded) return;
    const db = getDb();
    const [productSnap, orderSnap] = await Promise.all([
      getDocsFromServer(query(collection(db, 'products'), limit(1))),
      getDocsFromServer(query(collection(db, 'orders'), limit(1))),
    ]);

    await this.mutex(async () => {
      if (this.data.cloudSeeded) return;
      const remoteEmpty = productSnap.empty && orderSnap.empty;
      const hasLocal =
        this.data.products.length > 0 || this.data.orders.length > 0 || this.data.history.length > 0;
      if (remoteEmpty && hasLocal) {
        const ops = planSyncOps(emptyInventory(), this.data);
        this.data = { ...this.data, outbox: [...this.data.outbox, ...ops], cloudSeeded: true };
      } else {
        this.data = { ...this.data, cloudSeeded: true };
      }
      await saveInventory(this.data);
      this.emit();
    });
  }

  private listen(): void {
    if (this.unsubscribers.length > 0) return;
    const db = getDb();

    this.unsubscribers.push(
      onSnapshot(
        collection(db, 'products'),
        (snap) => {
          const normalized = normalizeInventory({
            ...emptyInventory(),
            products: snap.docs.map((item) => productFromFirestore(item.id, item.data())),
          });
          void this.mutex(async () => {
            this.remoteProducts = normalized?.products ?? [];
            this.sawProducts = true;
            this.trustProducts = !snap.metadata.fromCache;
            this.noteCache(snap.metadata.fromCache);
            await this.applyRemote();
          });
        },
        (error) => {
          this.syncError = mapFirestoreError(error);
          this.emit();
        }
      )
    );

    this.unsubscribers.push(
      onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          const normalized = normalizeInventory({
            ...emptyInventory(),
            orders: snap.docs.map((item) => orderFromFirestore(item.id, item.data())),
          });
          void this.mutex(async () => {
            this.remoteOrders = normalized?.orders ?? [];
            this.sawOrders = true;
            this.trustOrders = !snap.metadata.fromCache;
            this.noteCache(snap.metadata.fromCache);
            await this.applyRemote();
          });
        },
        (error) => {
          this.syncError = mapFirestoreError(error);
          this.emit();
        }
      )
    );

    this.unsubscribers.push(
      onSnapshot(
        collection(db, 'history'),
        (snap) => {
          const historyDocs = snap.docs.map((item) => historyFromFirestore(item.id, item.data()));
          const fromCache = snap.metadata.fromCache;
          void this.mutex(async () => {
            const normalized = normalizeInventory(
              { ...emptyInventory(), history: historyDocs },
              { keepOrphanHistory: true }
            );
            this.remoteHistory = normalized?.history ?? [];
            this.sawHistory = true;
            this.noteCache(fromCache);
            await this.applyRemote();
          });
        },
        (error) => {
          this.syncError = mapFirestoreError(error);
          this.emit();
        }
      )
    );

    this.unsubscribers.push(
      onSnapshot(
        doc(db, 'meta', 'settings'),
        (snap) => {
          const value = snap.exists() ? snap.data().lastActor : null;
          void this.mutex(async () => {
            this.remoteActor = typeof value === 'string' ? value : null;
            await this.applyRemote();
          });
        },
        () => undefined
      )
    );

    this.unsubscribers.push(
      onSnapshot(
        collection(db, 'deliveries'),
        (snap) => {
          const normalized = normalizeInventory({
            ...emptyInventory(),
            intakes: snap.docs.map((item) => intakeFromFirestore(item.id, item.data())),
          });
          void this.mutex(async () => {
            this.remoteIntakes = normalized?.intakes ?? [];
            this.sawIntakes = true;
            this.trustIntakes = !snap.metadata.fromCache;
            this.noteCache(snap.metadata.fromCache);
            await this.applyRemote();
          });
        },
        (error) => {
          this.syncError = mapFirestoreError(error);
          this.emit();
        }
      )
    );
  }

  private noteCache(fromCache: boolean): void {
    if (fromCache) this.offline = true;
    else this.offline = false;
  }

  /** Caller must already hold the mutex. */
  private async applyRemote(): Promise<void> {
    if (!this.sawProducts || !this.sawOrders || !this.sawHistory) return;

    const products = mergeProducts(
      this.data.products,
      this.remoteProducts ?? [],
      this.data.outbox,
      this.trustProducts
    );
    const orders = mergeOrders(this.data.orders, this.remoteOrders ?? [], this.data.outbox, this.trustOrders);
    const intakes = this.sawIntakes
      ? mergeIntakes(this.data.intakes, this.remoteIntakes ?? [], this.data.outbox, this.trustIntakes)
      : this.data.intakes;
    const remoteHistory = this.remoteHistory ?? [];
    const historyIds = new Set(remoteHistory.map((entry) => entry.id));
    const history = [
      ...remoteHistory,
      ...this.data.history.filter((entry) => !historyIds.has(entry.id)),
    ];
    const settingsPending = this.data.outbox.some((op) => op.kind === 'settings');
    const normalized = normalizeInventory({
      ...this.data,
      products,
      orders,
      intakes,
      history,
      lastActor: settingsPending || this.remoteActor === null ? this.data.lastActor : this.remoteActor,
      cloudSeeded: true,
    });
    if (!normalized) return;
    const adjusted = applyReservations(normalized);
    const pendingProducts = new Set(
      this.data.outbox.filter((op) => op.kind === 'upsert-product').map((op) => op.productId)
    );
    const drift = planSyncOps(normalized, adjusted).filter(
      (op) => op.kind === 'upsert-product' && op.productId && !pendingProducts.has(op.productId)
    );
    adjusted.outbox = [...this.data.outbox, ...drift];
    this.data = adjusted;
    await saveInventory(this.data);
    this.emit();
  }

  private flush(): Promise<void> {
    if (!isFirebaseConfigured()) return Promise.resolve();
    if (!this.flushing) {
      this.flushing = this.flushInner().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async flushInner(): Promise<void> {
    await this.mutex(async () => {
      let db: Firestore;
      try {
        db = getDb();
      } catch (error) {
        this.syncError = mapFirestoreError(error);
        this.emit();
        return;
      }

      while (this.data.outbox.length > 0) {
        const planned = coalesceOps(this.data.outbox);
        if (planned.length === 0) {
          this.data = { ...this.data, outbox: [] };
          await saveInventory(this.data);
          break;
        }
        const op = planned[0];
        try {
          await this.applyFlushOp(db, op);
          const done = new Set(op.sourceIds);
          this.data = { ...this.data, outbox: this.data.outbox.filter((item) => !done.has(item.id)) };
          this.syncError = null;
          await saveInventory(this.data);
          this.emit();
        } catch (error) {
          if (isOfflineError(error)) this.offline = true;
          else this.syncError = mapFirestoreError(error);
          this.emit();
          return;
        }
      }
    });
  }

  private async applyFlushOp(db: Firestore, op: FlushOp): Promise<void> {
    if (op.kind === 'upsert-product' && op.productId) {
      const product = this.data.products.find((item) => item.id === op.productId);
      if (!product) return;
      await withTimeout(setDoc(doc(db, 'products', product.id), productToFirestore(product)));
      return;
    }
    if (op.kind === 'delete-product' && op.productId) {
      await withTimeout(deleteDoc(doc(db, 'products', op.productId)));
      return;
    }
    if (op.kind === 'upsert-order' && op.orderId) {
      const order = this.data.orders.find((item) => item.orderId === op.orderId);
      if (!order) return;
      await withTimeout(setDoc(doc(db, 'orders', order.orderId), orderToFirestore(order)));
      return;
    }
    if (op.kind === 'delete-order' && op.orderId) {
      await withTimeout(deleteDoc(doc(db, 'orders', op.orderId)));
      return;
    }
    if (op.kind === 'upsert-intake' && op.deliveryId) {
      const intake = this.data.intakes.find((item) => item.deliveryId === op.deliveryId);
      if (!intake) return;
      await withTimeout(setDoc(doc(db, 'deliveries', intake.deliveryId), intakeToFirestore(intake)));
      return;
    }
    if (op.kind === 'delete-intake' && op.deliveryId) {
      await withTimeout(deleteDoc(doc(db, 'deliveries', op.deliveryId)));
      return;
    }
    if (op.kind === 'settings') {
      await withTimeout(
        setDoc(doc(db, 'meta', 'settings'), { lastActor: this.data.lastActor }, { merge: true })
      );
      return;
    }
    if (op.kind === 'append-history') {
      const entries = (op.entryIds ?? [])
        .map((id) => this.data.history.find((entry) => entry.id === id))
        .filter((entry): entry is HistoryEntry => entry !== undefined);
      for (let index = 0; index < entries.length; index += WRITE_CHUNK) {
        const batch = writeBatch(db);
        for (const entry of entries.slice(index, index + WRITE_CHUNK)) {
          batch.set(doc(db, 'history', entry.id), historyToFirestore(entry));
        }
        await withTimeout(batch.commit());
      }
    }
  }

  private async receiveWithRetry(deliveryId: string, actor: string, now: string) {
    try {
      return await runIntakeTransaction(getDb(), deliveryId, actor, now);
    } catch (error) {
      if (!firestoreCode(error).includes('aborted')) throw error;
      return runIntakeTransaction(getDb(), deliveryId, actor, now);
    }
  }

  private async deliverWithRetry(orderId: string, actor: string, now: string) {
    try {
      return await runDeliveryTransaction(getDb(), orderId, actor, now);
    } catch (error) {
      if (!firestoreCode(error).includes('aborted')) throw error;
      return runDeliveryTransaction(getDb(), orderId, actor, now);
    }
  }

  private mutex<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private syncState(): SyncState {
    if (!isFirebaseConfigured()) return { mode: 'local-only', message: copy.syncLocalOnly };
    if (this.syncError) return { mode: 'error', message: this.syncError };
    if (this.data.outbox.length > 0) return { mode: 'pending', message: copy.syncPending };
    if (this.offline) return { mode: 'offline', message: copy.syncOffline };
    return { mode: 'synced', message: null };
  }

  private snapshot(): RepositorySnapshot {
    return {
      data: this.data,
      sync: this.syncState(),
      ready: this.ready,
      loadError: this.loadError,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const inventoryRepository = new InventoryRepository();
