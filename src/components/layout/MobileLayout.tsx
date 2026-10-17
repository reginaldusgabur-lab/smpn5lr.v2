import React from 'react';
import { BottomNavigation } from './bottom-navigation';
import { Header } from './header';

/**
 * Layout khusus Mobile dengan pembatasan lebar halaman (Bounded Layout).
 * Memberikan kesan aplikasi yang lebih rapi dan profesional.
 */
export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-svh bg-muted/30 w-full overflow-hidden items-center">
      {/* Container utama dibatasi lebarnya (max-w-md) dan memiliki bayangan halus */}
      <div className="w-full max-w-md flex flex-col h-full bg-background relative shadow-2xl border-x border-border/5">
        <Header />
        <main className="flex-1 overflow-y-auto w-full bg-background scroll-smooth no-scrollbar">
          {/* Padding bawah ditambah (pb-32) untuk memberi ruang bagi floating menu */}
          <div className="w-full px-4 pt-3 pb-32 flex flex-col items-stretch bg-background">
              {children}
          </div>
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
