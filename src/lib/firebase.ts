import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Analytics — optional, guard against ad-blockers and non-browser envs
if (typeof window !== 'undefined' && 'measurementId' in firebaseConfig) {
  import('firebase/analytics')
    .then(({ getAnalytics }) => { getAnalytics(app); })
    .catch(() => { /* silently skip if blocked */ });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?:       string | null;
    email?:        string | null;
    emailVerified?: boolean | null;
    isAnonymous?:  boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId:        auth.currentUser?.uid           ?? null,
      email:         auth.currentUser?.email         ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous:   auth.currentUser?.isAnonymous   ?? null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Lightweight connection probe — uses static imports, never throws
export async function testConnection(): Promise<void> {
  try {
    await getDoc(doc(db, '_ping', 'test'));
    console.info('%c✓ Firebase connected — exhibition-hub-70b7c', 'color:#22d3ee');
  } catch {
    // Errors here are non-fatal (Firestore not enabled yet, permission denied, offline, etc.)
    console.warn('Firebase: Firestore not reachable — running in offline/demo mode.');
  }
}

// Fire-and-forget — app continues even if this fails
testConnection();
