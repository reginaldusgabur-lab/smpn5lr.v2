
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  type User, 
  onAuthStateChanged, 
  type Auth 
} from 'firebase/auth';
import { 
  type Firestore, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import type { UserProfile } from '@/types';

interface FirebaseContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  userProfile: null,
  isLoading: true,
});

export function FirebaseProvider({ 
  children, 
  auth, 
  firestore 
}: { 
  children: React.ReactNode; 
  auth: Auth; 
  firestore: Firestore;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  if (isLoading) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-white">
        <div className="flex space-x-2">
          <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
          <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
          <div className="h-3 w-3 animate-bounce rounded-full bg-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={{ user, userProfile, isLoading }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useUser = () => useContext(FirebaseContext);
export const useFirestore = () => {
  // In a real app, you'd get this from another context or a global
  // For this prototype, we'll assume it's available via a custom hook if needed
  // or just import the singleton.
  const { firestore } = require('@/firebase');
  return firestore as Firestore;
};
