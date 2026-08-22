import React from 'react';
import { BottomNavigation } from './bottom-navigation';
import { Header } from './header';

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-svh bg-background w-full overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto w-full bg-background scroll-smooth">
        <div className="w-full px-4 pt-3 pb-24 flex flex-col items-stretch bg-background">
            {children}
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
