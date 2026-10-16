'use client';

import React from 'react';

/**
 * Global Loading UI minimalis yang tidak mengganggu behavior scroll browser.
 */
export default function Loading() {
  return (
    <div className="absolute top-0 left-0 right-0 z-[9999] pointer-events-none h-1 bg-primary/10 overflow-hidden">
      <div className="w-full h-full bg-primary animate-loading-bar origin-left" />
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
