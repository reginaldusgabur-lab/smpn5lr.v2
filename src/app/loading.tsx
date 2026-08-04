'use client';

/**
 * Global Loading Component yang dioptimalkan.
 * Menggunakan gaya transparan agar transisi antar halaman terasa lebih cepat.
 */
export default function Loading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-[9999] w-full h-full pointer-events-none transition-opacity duration-300">
      <div className="flex items-center gap-2 bg-card/80 p-4 rounded-2xl shadow-xl border border-primary/10">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
