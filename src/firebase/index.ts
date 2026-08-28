'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

// Inisialisasi App secara idempotent
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Inisialisasi Firestore dengan pengaman re-initialization.
 * Menggunakan experimentalForceLongPolling untuk stabilitas maksimal di lingkungan Vercel/Studio.
 * Ini mencegah error "Could not reach Cloud Firestore backend" yang disebabkan oleh blokir gRPC/WebSocket.
 */
const firestore = getApps().length 
  ? getFirestore(app) 
  : initializeFirestore(app, {
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
