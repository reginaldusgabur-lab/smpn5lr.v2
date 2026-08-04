'use client';

/**
 * Global Loading dinonaktifkan untuk mencegah konflik dengan Auth Gate.
 * Transisi ditangani secara internal oleh Provider untuk kecepatan maksimal.
 */
export default function Loading() {
  return null;
}
