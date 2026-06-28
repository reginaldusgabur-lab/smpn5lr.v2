'use client';

import Image from 'next/image';

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-[9999]">
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative w-24 h-24 animate-logo-pulse">
          <Image
            src="/logo-3d-v2.png"
            alt="E-SPENLI"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-bold tracking-tight text-primary">E-SPENLI</h2>
          <div className="w-12 h-1 bg-primary/20 rounded-full overflow-hidden">
            <div className="w-full h-full bg-primary origin-left animate-progress-indefinite" />
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.5); }
          100% { transform: scaleX(1); }
        }
        @keyframes pulse-custom {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        .animate-progress-indefinite {
          animation: progress 1.5s infinite ease-in-out;
        }
        .animate-logo-pulse {
          animation: pulse-custom 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
