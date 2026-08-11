export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '',
};

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

export const missingFirebaseConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);
export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

/**
 * Some values were baked into this build and some were not. The build was meant
 * to sync and cannot, so the app must say so instead of quietly falling back to
 * local-only storage. A build with no Firebase values at all is a deliberate
 * local-only build and stays quiet.
 */
export const isFirebaseMisconfigured = missingFirebaseConfigKeys.length > 0
  && missingFirebaseConfigKeys.length < requiredConfigKeys.length;
