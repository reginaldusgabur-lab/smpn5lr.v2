'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth, type User } from 'firebase/auth';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    },
    collectionGroup: string | null;
  }
}

export function useCollection<T = any>(
    userForSubscription: User | null,
    memoizedTargetRefOrQuery: CollectionReference<DocumentData> | Query<DocumentData> | null | undefined,
): UseCollectionResult<T> {
  const [result, setResult] = useState<UseCollectionResult<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const lastQueryKey = useRef<string | null>(null);
  const lastUserUid = useRef<string | null>(null);

  // Reset state jika user berganti secara instan
  useEffect(() => {
    const currentUid = userForSubscription?.uid || null;
    if (currentUid !== lastUserUid.current) {
      setResult({ data: null, isLoading: !!memoizedTargetRefOrQuery, error: null });
      lastUserUid.current = currentUid;
      lastQueryKey.current = null;
    }
  }, [userForSubscription?.uid, memoizedTargetRefOrQuery]);

  useEffect(() => {
    let isMounted = true;

    if (!memoizedTargetRefOrQuery || !userForSubscription) {
      setResult({ data: null, isLoading: false, error: null });
      lastQueryKey.current = null;
      return;
    }

    let currentKey: string;
    if (memoizedTargetRefOrQuery.type === 'collection') {
        currentKey = (memoizedTargetRefOrQuery as CollectionReference).path;
    } else {
        currentKey = (memoizedTargetRefOrQuery as any)._query?.path?.canonicalString() || 'query';
    }

    if (currentKey !== lastQueryKey.current) {
        setResult({ data: null, isLoading: true, error: null });
        lastQueryKey.current = currentKey;
    }
    
    const subscriptionUid = userForSubscription.uid;

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (!isMounted) return;

        const currentAuthUser = getAuth().currentUser;
        if (currentAuthUser?.uid !== subscriptionUid) return;
        
        const results: WithId<T>[] = snapshot.docs.map(doc => ({ ...(doc.data() as T), id: doc.id }));
        setResult({ data: results, isLoading: false, error: null });
      },
      (error: FirestoreError) => {
        if (!isMounted) return;

        const currentAuthUser = getAuth().currentUser;
        if (currentAuthUser?.uid !== subscriptionUid) return;

        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
            return;
        }

        const internalQuery = (memoizedTargetRefOrQuery as unknown as InternalQuery)._query;
        if (internalQuery?.collectionGroup) {
          setResult({ data: null, isLoading: false, error });
          return;
        }

        let path = memoizedTargetRefOrQuery.type === 'collection' 
            ? (memoizedTargetRefOrQuery as CollectionReference).path 
            : (internalQuery?.path?.canonicalString() || '[query]');

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path,
        });
        
        setResult({ data: null, isLoading: false, error: contextualError });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [memoizedTargetRefOrQuery, userForSubscription?.uid]);

  return result;
}
