'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { CacheProvider } from '@/context/CacheContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMediaQuery } from '@/hooks/use-media-query';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { OnboardingTour } from '@/components/OnboardingTour';
import { SystemNotification } from '@/components/layout/SystemNotification';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const redirectChecked = useRef(false);

  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user && !redirectChecked.current) {
        redirectChecked.current = true;
        router.replace('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (user && !user.onboardingSelesai && !runTour) {
      if (sessionStorage.getItem('onboardingInProgress') !== 'true') {
        sessionStorage.setItem('onboardingInProgress', 'true');
        setRunTour(true);
      }
    }
  }, [user, runTour]);

  const handleTourComplete = async () => {
    runTour && setRunTour(false);
    if (!user || !firestore) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
      const updates = { onboardingSelesai: true };
      await setDoc(userDocRef, updates, { merge: true });
      
      const cached = sessionStorage.getItem('espenli_user_profile');
      if (cached) {
          const profile = JSON.parse(cached);
          sessionStorage.setItem('espenli_user_profile', JSON.stringify({ ...profile, ...updates }));
      }
    } catch (error) {
      console.error("Gagal menyimpan status onboarding:", error);
    }
  };

  // Menampilkan indikator pemuatan yang konsisten tanpa fixed position untuk menghindari scroll warning Next.js.
  if (isUserLoading || !user) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
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
        <SystemNotification />
        {isMobile ? (
          <MobileLayout>{children}</MobileLayout>
        ) : (
          <DesktopLayout>{children}</DesktopLayout>
        )}

        {!isMobile && <OnboardingTour run={runTour} onTourComplete={handleTourComplete} />}
      </SidebarProvider>
    </CacheProvider>
  );
}
