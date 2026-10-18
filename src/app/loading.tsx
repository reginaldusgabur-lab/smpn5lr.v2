'use client';

import React from 'react';

/**
 * Global Loading UI minimalis yang efisien.
 */
export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-1 bg-primary/10 overflow-hidden">
      <div className="w-full h-full bg-primary animate-pulse origin-left" />
    </div>
  );
}
