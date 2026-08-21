'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { User, UserProfile } from '@/types';
import Image from 'next/image';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth || !firestore) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth or Firestore service not provided.") });
      return;
    }

    const cached = sessionStorage.getItem('espenli_user_profile');
    if (cached) {
      try {
        const user = JSON.parse(cached);
        setUserAuthState({ user, isUserLoading: false, userError: null });
      } catch (e) {
        // Ignore malformed cache
      }
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userProfile = userDocSnap.data() as UserProfile;
              const combinedUser: User = {
                ...firebaseUser,
                ...userProfile,
                id: userDocSnap.id,
              };
              
              sessionStorage.setItem('espenli_user_profile', JSON.stringify(combinedUser));
              setUserAuthState({ user: combinedUser, isUserLoading: false, userError: null });
            } else {
              setUserAuthState({ user: null, isUserLoading: false, userError: null });
            }
          } catch (error) {
            setUserAuthState(prev => ({ ...prev, userError: error as Error, isUserLoading: false }));
          }
        } else {
          sessionStorage.removeItem('espenli_user_profile');
          setUserAuthState({ user: null, isUserLoading: false, userError: null });
        }
      },
      (error) => {
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      ...userAuthState,
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  if (userAuthState.isUserLoading && !userAuthState.user) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[9999] h-full w-full overflow-hidden">
        <div className="relative flex flex-col items-center justify-center gap-8">
            <div className="relative w-32 h-32 animate-logo-pulse">
                <Image
                  src="/logo-3d.png"
                  alt="Logo E-SPENLI"
                  fill
                  className="object-contain"
                  priority
                />
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-duration:0.8s]" />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-duration:0.8s] [animation-delay:0.3s]" />
            </div>
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      <div className="animate-fade-in-quick w-full h-full min-h-screen">
        {children}
      </div>
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase<T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);
  if (typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
