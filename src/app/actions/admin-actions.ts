
'use server';

/**
 * @fileOverview Tindakan sisi server untuk manajemen administratif pengguna.
 * Menggunakan Firebase Admin SDK untuk tugas-tugas yang membutuhkan hak akses tinggi.
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
 * Memerlukan Service Account dengan role "Firebase Auth Admin".
 */
export async function updateUserEmail(uid: string, newEmail: string) {
  try {
    if (!newEmail || !newEmail.includes('@')) {
      throw new Error('Format email tidak valid.');
    }

    console.log(`[ADMIN_ACTION] Mencoba memperbarui email untuk UID: ${uid} ke ${newEmail}`);
    
    await adminAuth.updateUser(uid, {
      email: newEmail,
      emailVerified: true // Set sebagai terverifikasi karena diubah oleh Admin
    });
    
    console.log(`[ADMIN_ACTION] Berhasil memperbarui email di Auth.`);
    return { success: true };
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Gagal memperbarui email di Firebase Auth:', error.message);
    
    // Memberikan pesan error yang lebih spesifik jika izin kurang
    if (error.code === 'auth/insufficient-permission') {
      return {
        success: false,
        error: 'Sistem tidak memiliki izin administratif (Insufficient Permission). Pastikan Service Account di Vercel memiliki role "Firebase Admin".'
      };
    }

    return { 
      success: false, 
      error: error.message || 'Gagal memperbarui email. Email mungkin sudah digunakan oleh akun lain.' 
    };
  }
}
