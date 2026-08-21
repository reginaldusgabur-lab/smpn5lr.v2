'use client';

import React from 'react';

/**
 * Global Loading UI.
 * Menampilkan indikator tiga titik yang konsisten di seluruh transisi rute Next.js
 * untuk menghilangkan jeda layar kosong (blank screen).
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s]" />
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
