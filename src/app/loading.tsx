'use client';

import React from 'react';

/**
 * Global Loading UI.
 * Mematenkan latar belakang putih agar transisi dari splash screen OS terasa mulus.
 */
export default function Loading() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-white">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s]" />
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
