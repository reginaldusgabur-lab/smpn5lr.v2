'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface QuoteOfTheDayProps {
  category: string | null | undefined;
  attendanceType: 'in' | 'out' | null;
}

interface Quote {
  quote: string;
  author: string;
}

const QuoteOfTheDay = ({ category, attendanceType }: QuoteOfTheDayProps) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFetched = useRef(false);

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null, 
    [firestore, user?.uid]
  );
  const { data: userData } = useDoc(user, userDocRef);

  const schoolConfigRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'schoolConfig', 'default') : null, 
    [firestore]
  );
  const { data: schoolConfig, isLoading: isConfigLoading } = useDoc<{
    isManualQuoteActive?: boolean;
    manualQuoteContent?: string;
  }>(user, schoolConfigRef);

  useEffect(() => {
    // Tunggu sampai data tersedia dan cegah re-fetch berlebih
    if (isConfigLoading || !userData || !attendanceType || isFetched.current) {
        if (!attendanceType && !isConfigLoading) setIsLoading(false);
        return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      isFetched.current = true;

      // 1. Cek Override Manual dari Admin
      if (schoolConfig?.isManualQuoteActive && schoolConfig?.manualQuoteContent?.trim()) {
          setQuote({
              quote: schoolConfig.manualQuoteContent.trim(),
              author: "AI E-SPENLI"
          });
          setIsLoading(false);
          return;
      }
      
      // 2. Jalur Normal: Fetch dari AI Flow (yang sekarang punya 200+ fallback)
      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      const dayStr = format(now, 'EEEE', { locale: id });
      const creativeSeed = `ENTROPY-${now.getTime()}-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({ 
            userName: userData.name || user?.displayName || 'Personil',
            userId: user?.uid,
            role: userData.role || category || 'pegawai',
            attendanceType,
            day: dayStr,
            date: dateStr,
            creativeSeed: creativeSeed
          }),
        });
        
        const data = await response.json();
        if (response.ok && data && data.quote) {
          setQuote(data);
        } else {
          throw new Error('AI_FAILURE');
        }
      } catch (e: any) {
        // Jika API error, fallback di sisi klien akan diambil dari database alur kerja yang baru
        setQuote({
          quote: attendanceType === 'in' 
            ? "Awali hari dengan niat baik untuk melayani di lingkungan SMPN 5 Langke Rembong." 
            : "Tugas tuntas, dedikasi terbayar. Selamat beristirahat bersama keluarga tercinta.",
          author: "Sistem E-SPENLI"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [userData, attendanceType, user?.uid, category, schoolConfig, isConfigLoading]);

  if (!attendanceType) return null;

  return (
    <div className="mt-2 pt-4">
      <div className="flex items-center justify-center text-[10px] font-black mb-4 text-muted-foreground/50 uppercase tracking-[0.2em]">
        <Sparkles className="h-3 w-3 mr-2 text-amber-500 animate-pulse" />
        Kutipan Untuk Anda
      </div>
      <div className="text-center min-h-[60px] flex flex-col items-center justify-center px-2">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-widest">Meramu kata...</span>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000 w-full space-y-4">
            <blockquote className="font-bold text-[16px] text-foreground/90 leading-snug italic text-center px-2">
              "{quote?.quote}"
            </blockquote>
            <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">
              — {quote?.author || "AI E-SPENLI"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteOfTheDay;
