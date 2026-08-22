import React from 'react';
import { AppSidebar } from './app-sidebar';
import { Header } from './header';
import { AppFooter } from './app-footer';

export function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden bg-background sm:flex sm:h-screen sm:w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 pt-2 bg-background scroll-smooth">
          <div className="w-full">{children}</div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
