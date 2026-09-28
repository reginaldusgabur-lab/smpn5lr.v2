
import admin from "firebase-admin";

/**
 * Inisialisasi Firebase Admin SDK secara aman.
 * Menangani perbedaan format environment variables antara lokal dan Vercel.
 */

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (admin.apps.length === 0) {
  try {
    if (projectId && clientEmail && privateKey) {
      // Membersihkan tanda petik pembungkus dan memastikan \n di-parse menjadi baris baru yang nyata
      const formattedKey = privateKey
        .replace(/^['"]|['"]$/g, '') // Hapus tanda petik tunggal atau ganda di awal/akhir
        .replace(/\\n/g, '\n');     // Ubah literal \n menjadi karakter new-line

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
        databaseURL: `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`
      });
      console.log('Firebase Admin: Berhasil diinisialisasi menggunakan Service Account.');
    } else {
      // Fallback untuk lingkungan lokal yang mungkin menggunakan ADC
      admin.initializeApp();
      console.log('Firebase Admin: Menggunakan Application Default Credentials.');
    }
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error.message);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
