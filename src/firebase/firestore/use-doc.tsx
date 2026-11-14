'use client';
    
import { useState, useEffect, useRef } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth, type User } from 'firebase/auth';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useDoc<T = any>(
  userForSubscription: User | null,
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  const [result, setResult] = useState<UseDocResult<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const lastPath = useRef<string | null>(null);
  const lastUserUid = useRef<string | null>(null);

  // Reset state jika user berganti secara instan
  useEffect(() => {
    const currentUid = userForSubscription?.uid || null;
    if (currentUid !== lastUserUid.current) {
      setResult({ data: null, isLoading: !!memoizedDocRef, error: null });
      lastUserUid.current = currentUid;
      lastPath.current = null;
    }
  }, [userForSubscription?.uid, memoizedDocRef]);

  useEffect(() => {
    let isMounted = true;
    const currentPath = memoizedDocRef?.path || null;

    if (!memoizedDocRef || !userForSubscription) {
      setResult({ data: null, isLoading: false, error: null });
      lastPath.current = null;
      return;
    }
    
    if (currentPath !== lastPath.current) {
        setResult({ data: null, isLoading: true, error: null });
        lastPath.current = currentPath;
    }
    
    const subscriptionUid = userForSubscription.uid;

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!isMounted) return;

        const currentAuthUser = getAuth().currentUser;
        if (currentAuthUser?.uid !== subscriptionUid) return;
        
        if (snapshot.exists()) {
          const data = { ...(snapshot.data() as T), id: snapshot.id };
          setResult({ data, isLoading: false, error: null });
        } else {
          setResult({ data: null, isLoading: false, error: null });
        }
      },
      (error: FirestoreError) => {
        if (!isMounted) return;
        
        const currentAuthUser = getAuth().currentUser;
        if (currentAuthUser?.uid !== subscriptionUid) return;

        if (error.code === 'unavailable') return;

        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });
        
        setResult({ data: null, isLoading: false, error: contextualError });
      }
    );

    return () => {
        isMounted = false;
        unsubscribe();
    };
  }, [memoizedDocRef, userForSubscription?.uid]);

  return result;
}
