'use client';

import React from 'react';

/**
 * Global Loading UI.
 * Memaksa latar belakang putih bersih untuk menghilangkan kilatan hitam.
 * Menggunakan animasi yang sangat ringan.
 */
export default function Loading() {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center bg-white overflow-hidden">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:0.2s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
