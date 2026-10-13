'use client';

import React from 'react';

/**
 * Global Loading UI yang sangat minimalis.
 * Menggunakan overlay transparan tanpa elemen yang mencolok untuk mencegah kesan "lemot" saat transisi halaman.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center pointer-events-none bg-background/5 duration-300 animate-in fade-in">
      <div className="w-full h-1 bg-primary/20 overflow-hidden">
        <div className="w-1/3 h-full bg-primary animate-[loading-bar_1.5s_infinite_linear]" />
      </div>
      <style jsx>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
