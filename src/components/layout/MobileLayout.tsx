import React from 'react';
import { BottomNavigation } from './bottom-navigation';
import { Header } from './header';

/**
 * Layout khusus Mobile yang mengisi seluruh lebar layar (Full Width).
 * Memberikan kesan aplikasi native yang bersih dan responsif.
 */
export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-svh bg-background w-full overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto w-full bg-background scroll-smooth no-scrollbar">
        {/* Konten utama dengan padding bawah agar tidak tertutup navigasi */}
        <div className="w-full px-4 pt-4 pb-20 flex flex-col items-stretch bg-background">
            {children}
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
