'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache
} from 'firebase/firestore';

/**
 * Inisialisasi Firebase App secara idempotent.
 */
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Inisialisasi Firestore dengan Offline Persistence dan Long Polling.
 * experimentalForceLongPolling dipaksa aktif untuk stabilitas di lingkungan studio/workstation/lingkungan sinyal lemah.
 */
const firestore = (() => {
  if (typeof window !== 'undefined') {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({}),
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      return getFirestore(app);
    }
  }
  return getFirestore(app);
})();

export { app as firebaseApp, auth, firestore };

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';