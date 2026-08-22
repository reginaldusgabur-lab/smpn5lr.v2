'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CacheProvider } from "@/context/CacheContext";

/**
 * Dashboard Layout dengan perbaikan jalur impor AppSidebar.
 * Tetap menggunakan indikator pemuatan Ice White (Tanpa Logo) untuk diagnosa.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  // Loading Guard: Menggunakan latar belakang putih solid dan tiga titik membal
  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center bg-white h-svh w-full overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.3s]" />
        </div>
      </div>
    );
  }

  return (
    <CacheProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AppSidebar />
          <main className="flex-1 w-full">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </CacheProvider>
  );
}
