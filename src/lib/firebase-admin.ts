import admin from "firebase-admin";

/**
 * Konfigurasi Firebase Admin SDK menggunakan Variabel Lingkungan.
 * Pastikan Anda telah menambahkan variabel berikut di dashboard Vercel atau file .env:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 */
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  try {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        // Ganti URL database jika Anda menggunakan Realtime Database
        databaseURL: `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`
      });
      console.log('Firebase Admin initialized with service account.');
    } else {
      // Fallback ke Application Default Credentials (ADC)
      admin.initializeApp();
      console.log('Firebase Admin initialized with default credentials.');
    }
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', error.stack);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };
