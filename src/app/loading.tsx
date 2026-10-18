'use client';

import React from 'react';

/**
 * Global Loading UI yang efisien.
 * Menggunakan pembungkus div standar untuk menghindari peringatan 'auto-scroll' Next.js
 * yang muncul jika elemen akar komponen loading menggunakan position: fixed.
 */
export default function Loading() {
  return (
    <div className="w-full">
      <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-0.5 bg-primary/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-full bg-primary animate-pulse origin-left" />
      </div>
    </div>
  );
}
