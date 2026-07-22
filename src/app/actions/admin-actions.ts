'use server';

/**
 * @fileOverview Tindakan sisi server untuk manajemen administratif pengguna.
 */

import { adminAuth } from '@/lib/firebase-admin';

/**
 * Reset kata sandi pengguna secara manual oleh Admin.
 * @param uid UID pengguna yang akan direset.
 * @param newPass Kata sandi baru yang akan disetel.
 */
export async function resetUserPassword(uid: string, newPass: string) {
  try {
    // Pastikan password minimal 6 karakter
    if (newPass.length < 6) {
      throw new Error('Kata sandi harus minimal 6 karakter.');
    }

    await adminAuth.updateUser(uid, {
      password: newPass,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return { 
      success: false, 
      error: error.message || 'Gagal mereset kata sandi. Silakan coba lagi.' 
    };
  }
}
