import React from 'react';
import { BottomNavigation } from './bottom-navigation';
import { Header } from './header';

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-hidden min-h-screen bg-muted/20">
      <Header />
      {/* 
        The main content area is now consistent across all pages.
        - Fixed Header (pt-16)
        - Fixed Bottom Navigation (pb-20)
      */}
      <main className="pt-16 pb-20">
        <div className="p-4">
            {children}
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
