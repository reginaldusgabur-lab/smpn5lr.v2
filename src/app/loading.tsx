'use client';

import React from 'react';

/**
 * Global Loading UI yang sangat minimalis.
 * Menghilangkan fixed inset-0 yang menyebabkan browser warning 'Skipping auto-scroll'.
 * Menggunakan bar tipis di bagian paling atas layar.
 */
export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="w-full h-1 bg-primary/10 overflow-hidden">
        <div className="w-full h-full bg-primary animate-loading-bar origin-left" />
      </div>
      <style jsx global>{`
        @keyframes loading-bar {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); opacity: 0; }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
