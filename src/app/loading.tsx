'use client';

import React from 'react';

/**
 * Global Loading UI yang disederhanakan.
 * Menggunakan indikator tunggal yang sangat minimalis untuk mencegah efek "flickering" 
 * atau tampilan berulang yang mengganggu pengguna saat perpindahan halaman.
 */
export default function Loading() {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center bg-background overflow-hidden animate-fade-in-quick">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </div>
      </div>
    </div>
  );
}
