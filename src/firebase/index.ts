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
 * Penting untuk lingkungan Next.js agar tidak terjadi error re-initialization.
 */
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Inisialisasi Firestore dengan Offline Persistence dan Long Polling.
 * experimentalForceLongPolling dipaksa aktif untuk mengatasi error "Could not reach backend"
 * yang umum terjadi di lingkungan proxy/studio yang memblokir WebSocket.
 */
const firestore = (() => {
  if (typeof window !== 'undefined') {
    // Di sisi klien, kita coba gunakan inisialisasi kustom
    try {
      // Jika sudah ada instance, getFirestore akan mengembalikannya.
      // initializeFirestore hanya dipanggil sekali.
      return initializeFirestore(app, {
        localCache: persistentLocalCache({}),
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // Jika terjadi error (misal sudah diinisialisasi), ambil instance yang ada
      return getFirestore(app);
    }
  }
  // Di sisi server, gunakan default
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
