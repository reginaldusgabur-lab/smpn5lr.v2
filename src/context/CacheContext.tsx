'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, DocumentData } from 'firebase/firestore';
import { format } from 'date-fns';

interface CacheContextType {
  schoolConfig: DocumentData | null;
  monthlyConfig: DocumentData | null;
  isCacheLoading: boolean;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export function CacheProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [config, setConfig] = useState<DocumentData | null>(null);
  const [mConfig, setMConfig] = useState<DocumentData | null>(null);
  const [monthId, setMonthId] = useState<string | null>(null);

  useEffect(() => {
    setMonthId(format(new Date(), 'yyyy-MM'));
  }, []);

  const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
  const { data: fetchedConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const monthlyConfigRef = useMemoFirebase(() => (firestore && monthId) ? doc(firestore, 'monthlyConfigs', monthId) : null, [firestore, monthId]);
  const { data: fetchedMonthlyConfig, isLoading: isMonthlyLoading } = useDoc(user, monthlyConfigRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && !config) {
      const backup = sessionStorage.getItem('espenli_config_backup');
      if (backup) {
        try { setConfig(JSON.parse(backup)); } catch (e) {}
      }
      const mBackup = sessionStorage.getItem('espenli_mconfig_backup');
      if (mBackup) {
        try { setMConfig(JSON.parse(mBackup)); } catch (e) {}
      }
    }
  }, [config]);

  useEffect(() => {
    if (fetchedConfig) {
      setConfig(fetchedConfig);
      sessionStorage.setItem('espenli_config_backup', JSON.stringify(fetchedConfig));
    }
  }, [fetchedConfig]);

  useEffect(() => {
    if (fetchedMonthlyConfig) {
      setMConfig(fetchedMonthlyConfig);
      sessionStorage.setItem('espenli_mconfig_backup', JSON.stringify(fetchedMonthlyConfig));
    }
  }, [fetchedMonthlyConfig]);

  const value = useMemo(() => ({
    schoolConfig: config,
    monthlyConfig: mConfig,
    isCacheLoading: (isConfigLoading && !config) || (isMonthlyLoading && !mConfig),
  }), [config, mConfig, isConfigLoading, isMonthlyLoading]);

  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>;
}

export function useCache() {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}
