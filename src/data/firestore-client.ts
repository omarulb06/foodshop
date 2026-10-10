import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  CACHE_SIZE_UNLIMITED,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore';

import { firebaseConfig, isFirebaseConfigured } from '@/data/firebase-config';
import { copy } from '@/lib/copy';

let app: FirebaseApp | null = null;
let database: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(copy.syncLocalOnly);
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Offline persistence is requested first on both iOS and Android. The JS SDK
 * often falls back to a memory cache; the repository still keeps a SQLite
 * copy so scans and stock edits work after a restart with no network.
 */
export function getDb(): Firestore {
  if (database) return database;
  const firebaseApp = getFirebaseApp();
  try {
    database = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already')) {
      database = getFirestore(firebaseApp);
    } else {
      try {
        database = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
      } catch {
        database = getFirestore(firebaseApp);
      }
    }
  }
  return database;
}

export function firestoreCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return '';
}

export function isOfflineError(error: unknown): boolean {
  const code = firestoreCode(error);
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('network-request-failed') ||
    message.includes('offline') ||
    message.includes('network')
  );
}

export function mapFirestoreError(error: unknown): string {
  const code = firestoreCode(error);
  if (code.includes('permission-denied')) return copy.syncPermission;
  if (isOfflineError(error)) return copy.syncOffline;
  if (error instanceof Error && error.message) return error.message;
  return copy.syncFailed;
}

/** `setDoc` waits for the server and would otherwise stall forever while offline. */
export function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('offline'), { code: 'unavailable' }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
