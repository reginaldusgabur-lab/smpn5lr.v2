
import admin from "firebase-admin";

/**
 * Inisialisasi Firebase Admin SDK secara aman untuk lingkungan server (Next.js/Vercel).
 * Memastikan kredensial Service Account diproses dengan benar.
 */

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (admin.apps.length === 0) {
  try {
    // Membersihkan private key dari tanda petik pembungkus dan literal \n
    const formattedKey = privateKey
      ? privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
      : undefined;

    if (projectId && clientEmail && formattedKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
        // Database URL opsional namun disarankan untuk kelengkapan inisialisasi
        databaseURL: `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`
      });
      console.log('Firebase Admin: Berhasil diinisialisasi dengan Service Account.');
    } else {
      // Fallback ke kredensial default lingkungan (lokal)
      admin.initializeApp();
      console.log('Firebase Admin: Menggunakan Application Default Credentials.');
    }
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error.message);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
