import Constants from 'expo-constants';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readExtra(): Partial<FirebaseWebConfig> {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object' || !('firebase' in extra)) return {};
  const firebase = (extra as { firebase?: unknown }).firebase;
  if (!firebase || typeof firebase !== 'object') return {};
  return firebase as Partial<FirebaseWebConfig>;
}

function pick(envValue: string | undefined, extraValue: unknown): string {
  if (typeof envValue === 'string' && envValue.trim()) return envValue.trim();
  return typeof extraValue === 'string' ? extraValue.trim() : '';
}

const extra = readExtra();

/** Web app config from the Firebase console. These values identify the project. */
export const firebaseConfig: FirebaseWebConfig = {
  apiKey: pick(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, extra.apiKey),
  authDomain: pick(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, extra.authDomain),
  projectId: pick(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, extra.projectId),
  storageBucket: pick(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, extra.storageBucket),
  messagingSenderId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    extra.messagingSenderId
  ),
  appId: pick(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, extra.appId),
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}
