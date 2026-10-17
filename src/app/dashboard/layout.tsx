'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
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

  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
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
    setRunTour(false);
    if (!user || !firestore) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
      const updates = { onboardingSelesai: true };
      await setDoc(userDocRef, updates, { merge: true });
      
      const cached = localStorage.getItem('espenli_user_profile_v2');
      if (cached) {
          const profile = JSON.parse(cached);
          localStorage.setItem('espenli_user_profile_v2', JSON.stringify({ ...profile, ...updates }));
      }
    } catch (error) {
      console.error("Gagal menyimpan status onboarding:", error);
    }
  };

  // Optimasi: Jika user belum ada di state (baru login), biarkan NextJS loading.tsx menangani transisi.
  // Jangan me-render apa pun untuk mencegah flash blank screen putih yang dipaksakan.
  if (!user) return null;

  return (
    <SidebarProvider>
      <SystemNotification />
      <div className="bg-background min-h-screen w-full">
        {isMobile ? (
          <MobileLayout>{children}</MobileLayout>
        ) : (
          <DesktopLayout>{children}</DesktopLayout>
        )}
      </div>
      {!isMobile && <OnboardingTour run={runTour} onTourComplete={handleTourComplete} />}
    </SidebarProvider>
  );
}
