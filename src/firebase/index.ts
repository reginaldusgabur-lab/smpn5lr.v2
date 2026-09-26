'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache
} from 'firebase/firestore';

// Inisialisasi App secara idempotent
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Inisialisasi Firestore dengan fitur Offline Persistence (Cache Lokal).
 * persistentLocalCache() mengaktifkan penyimpanan data di browser (IndexedDB) secara otomatis.
 * Saat aplikasi dibuka kembali, Firestore akan membaca data dari cache ini terlebih dahulu,
 * yang secara drastis mengurangi Server Reads dan biaya database.
 * 
 * experimentalForceLongPolling dipertahankan untuk menjamin stabilitas koneksi 
 * di lingkungan yang membatasi WebSocket/gRPC.
 */
const firestore = (() => {
  if (typeof window !== 'undefined') {
    // Cek apakah Firestore sudah diinisialisasi untuk stabilitas HMR
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({}),
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // Jika sudah diinisialisasi, ambil instance yang ada
      return getFirestore(app);
    }
  }
  // Fallback untuk Server-Side Rendering (SSR)
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
