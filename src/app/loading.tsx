'use client';

import React from 'react';

/**
 * Global Loading UI yang efisien dan ringan.
 * Menggunakan elemen span untuk menghindari peringatan 'auto-scroll' pada browser
 * saat terjadi transisi halaman dengan elemen fixed.
 */
export default function Loading() {
  return (
    <span className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-0.5 bg-primary/10 overflow-hidden block">
      <span className="absolute inset-y-0 left-0 w-full bg-primary animate-pulse origin-left block" />
    </span>
  );
}
