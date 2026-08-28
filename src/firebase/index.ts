
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Inisialisasi Firestore dengan pengaturan khusus.
 * Menggunakan experimentalForceLongPolling untuk stabilitas koneksi yang lebih baik
 * di lingkungan cloud/proxied seperti Vercel dan Firebase Studio.
 */
const firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export { app as firebaseApp, auth, firestore };

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
