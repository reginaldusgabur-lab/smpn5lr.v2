import React from 'react';
import { BottomNavigation } from './bottom-navigation';
import { Header } from './header';

/**
 * Layout khusus Mobile dengan pembatasan lebar halaman (Bounded Layout).
 * Memberikan kesan aplikasi yang lebih rapi dan profesional.
 */
export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-svh bg-muted/40 w-full overflow-hidden items-center">
      {/* Container utama dibatasi lebarnya (max-w-md) */}
      <div className="w-full max-w-md flex flex-col h-full bg-background relative shadow-none border-x border-border/10">
        <Header />
        <main className="flex-1 overflow-y-auto w-full bg-background scroll-smooth no-scrollbar">
          {/* Padding bawah disesuaikan agar konten akhir tidak tertutup bar navigasi */}
          <div className="w-full px-4 pt-4 pb-20 flex flex-col items-stretch bg-background">
              {children}
          </div>
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
