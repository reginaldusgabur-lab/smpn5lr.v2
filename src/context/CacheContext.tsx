'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, DocumentData } from 'firebase/firestore';

interface CacheContextType {
  schoolConfig: DocumentData | null;
  isCacheLoading: boolean;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export function CacheProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [config, setConfig] = useState<DocumentData | null>(null);

  const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
  const { data: fetchedConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && !config) {
      const backup = sessionStorage.getItem('espenli_config_backup');
      if (backup) {
        try {
          setConfig(JSON.parse(backup));
        } catch (e) {}
      }
    }
  }, [config]);

  useEffect(() => {
    if (fetchedConfig) {
      setConfig(fetchedConfig);
      sessionStorage.setItem('espenli_config_backup', JSON.stringify(fetchedConfig));
    }
  }, [fetchedConfig]);

  const value = useMemo(() => ({
    schoolConfig: config,
    isCacheLoading: isConfigLoading && !config,
  }), [config, isConfigLoading]);

  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>;
}

export function useCache() {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}
