
'use server';

/**
 * @fileOverview Tindakan sisi server untuk manajemen administratif pengguna.
 * Menggunakan Firebase Admin SDK.
 */

import { adminAuth } from '@/lib/firebase-admin';

/**
 * Reset kata sandi pengguna secara manual oleh Admin.
 */
export async function resetUserPassword(uid: string, newPass: string) {
  try {
    if (newPass.length < 6) {
      throw new Error('Kata sandi harus minimal 6 karakter.');
    }

    await adminAuth.updateUser(uid, {
      password: newPass,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Error resetting password:', error.message);
    return { 
      success: false, 
      error: error.message || 'Gagal mereset kata sandi.' 
    };
  }
}

/**
 * Memperbarui email pengguna di sistem Firebase Authentication.
 */
export async function updateUserEmail(uid: string, newEmail: string) {
  try {
    if (!newEmail || !newEmail.includes('@')) {
      throw new Error('Format email tidak valid.');
    }

    console.log(`[ADMIN_ACTION] Mencoba memperbarui email untuk UID: ${uid} ke ${newEmail}`);
    
    await adminAuth.updateUser(uid, {
      email: newEmail,
      emailVerified: true
    });
    
    console.log(`[ADMIN_ACTION] Berhasil memperbarui email di Auth.`);
    return { success: true };
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Gagal memperbarui email:', error.message);
    
    // Penanganan error khusus jika dijalankan di lokal tanpa kredensial yang tepat
    if (error.code === 'app/invalid-credential' || error.message.includes('key')) {
      return {
        success: false,
        error: 'Kesalahan kredensial di lingkungan lokal. Pastikan file .env sudah benar.'
      };
    }

    return { 
      success: false, 
      error: error.message || 'Gagal memperbarui email. Mungkin sudah digunakan akun lain.' 
    };
  }
}
