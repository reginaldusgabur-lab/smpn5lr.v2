
import admin from "firebase-admin";

/**
 * Konfigurasi Firebase Admin SDK menggunakan Variabel Lingkungan.
 * Menangani pembersihan Private Key secara mendalam untuk mencegah error izin.
 */
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

// Membersihkan tanda petik pembungkus dan menangani escape character \n
const formattedPrivateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, '').replace(/\\n/g, '\n') 
  : undefined;

if (admin.apps.length === 0) {
  try {
    if (projectId && clientEmail && formattedPrivateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
        databaseURL: `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`
      });
      console.log('Firebase Admin: Berhasil inisialisasi dengan Service Account.');
    } else {
      // Fallback untuk lingkungan lokal jika file .env belum lengkap
      admin.initializeApp();
      console.log('Firebase Admin: Menggunakan kredensial default.');
    }
  } catch (error: any) {
    console.error('Firebase Admin: Gagal inisialisasi!', error.stack);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
