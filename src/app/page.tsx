
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Login from '@/components/Login';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || user) {
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

  return <Login />;
}
