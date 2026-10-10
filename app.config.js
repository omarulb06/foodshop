/**
 * Expo evaluates this after loading `.env`. EXPO_PUBLIC_* values are inlined
 * into the JavaScript bundle for both iOS and Android. Copying them into
 * `extra.firebase` keeps the same keys available through expo-constants when a
 * cloud build injects the variables as environment variables.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    firebase: {
      apiKey: read('EXPO_PUBLIC_FIREBASE_API_KEY'),
      authDomain: read('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      projectId: read('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
      storageBucket: read('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: read('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      appId: read('EXPO_PUBLIC_FIREBASE_APP_ID'),
    },
  },
});

function read(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}
