import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type NextOrObserver,
  type Unsubscribe,
  type User,
  type UserCredential,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export { isFirebaseConfigured, missingFirebaseConfigKeys } from './firebaseConfig';

const FIREBASE_APP_NAME = 'gym';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let servicesPromise: Promise<FirebaseServices | null> | undefined;

function getOrCreateApp(): FirebaseApp {
  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  return existingApp ?? initializeApp(firebaseConfig, FIREBASE_APP_NAME);
}

function getOrCreateFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Hot-module replacement can evaluate this module after Firestore already
    // exists for the named app. In that case, reuse the initialized instance.
    return getFirestore(app);
  }
}

async function initializeFirebaseServices(): Promise<FirebaseServices | null> {
  if (!isFirebaseConfigured) {
    return null;
  }

  const app = getOrCreateApp();
  const auth = getAuth(app);
  const db = getOrCreateFirestore(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Authentication still works with the SDK's available persistence mode.
    // Gym's localStorage data remains the primary offline fallback.
  }

  return { app, auth, db };
}

/**
 * Returns null when Firebase environment variables are absent. Callers should
 * keep the app in local-only mode in that case.
 */
export function getFirebaseServices(): Promise<FirebaseServices | null> {
  servicesPromise ??= initializeFirebaseServices();
  return servicesPromise;
}

export async function observeFirebaseAuth(
  observer: NextOrObserver<User>,
  onError?: (error: Error) => void,
): Promise<Unsubscribe> {
  const services = await getFirebaseServices();
  if (!services) {
    if (typeof observer === 'function') {
      observer(null);
    } else {
      observer.next?.(null);
    }
    return () => undefined;
  }

  return onAuthStateChanged(services.auth, observer, onError);
}

export async function signInToFirebaseWithGoogle(): Promise<UserCredential> {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error('Firebase is not configured for this build.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(services.auth, provider);
}

export async function signOutOfFirebase(): Promise<void> {
  const services = await getFirebaseServices();
  if (services) {
    await signOut(services.auth);
  }
}
