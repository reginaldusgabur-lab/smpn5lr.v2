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
  const [isClient, setIsClient] = useState(false);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const redirectChecked = useRef(false);

  // Onboarding state
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Redireksi cepat jika tidak ada user
    if (!isUserLoading && !user && !redirectChecked.current) {
        redirectChecked.current = true;
        router.replace('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    // Cek onboarding langsung dari data user yang sudah di-cache di Provider
    if (user && !user.onboardingSelesai && !runTour) {
      if (sessionStorage.getItem('onboardingInProgress') !== 'true') {
        sessionStorage.setItem('onboardingInProgress', 'true');
        setRunTour(true);
      }
    }
  }, [user, runTour]);

  const handleTourComplete = async () => {
    setRunTour(false);
    if (!user || !firestore) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
      const updates = { onboardingSelesai: true };
      await setDoc(userDocRef, updates, { merge: true });
      
      // Update cache lokal agar tidak flicker di refresh berikutnya
      const cached = sessionStorage.getItem('espenli_user_profile');
      if (cached) {
          const profile = JSON.parse(cached);
          sessionStorage.setItem('espenli_user_profile', JSON.stringify({ ...profile, ...updates }));
      }
    } catch (error) {
      console.error("Gagal menyimpan status onboarding:", error);
    }
  };

  if (!isClient) return null;

  // Loader di sini dihapus karena sudah ditangani oleh FirebaseProvider secara global
  if (!user && isUserLoading) return null;
  if (!user) return null;

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
