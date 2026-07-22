'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface QuoteOfTheDayProps {
  category: string | null | undefined;
  attendanceType: 'in' | 'out' | null;
}

interface Quote {
  quote: string;
  author: string;
}

const FALLBACK_QUOTES: Record<string, Quote[]> = {
  guru: [
    { quote: "RPP mungkin menumpuk, tapi semangat mencerdaskan bangsa harus tetap 'full tank'!", author: "AI E-SPENLI" },
    { quote: "Ingat, spidol yang macet adalah ujian kesabaran tingkat tinggi. Tetap semangat!", author: "AI E-SPENLI" }
  ],
  pegawai: [
    { quote: "Sinkronisasi Dapodik itu soal keberuntungan, tapi dedikasi Anda adalah kepastian.", author: "AI E-SPENLI" }
  ],
  default: [
    { quote: "Selamat beraktivitas di SMPN 5 Langke Rembong. Mari tebar energi positif!", author: "AI E-SPENLI" }
  ]
};

const QuoteOfTheDay = ({ category, attendanceType }: QuoteOfTheDayProps) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFetched = useRef(false);

  useEffect(() => {
    if (!category || !attendanceType || isFetched.current) {
      if (!category || !attendanceType) setIsLoading(false);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      isFetched.current = true;
      try {
        // Menghasilkan seed yang sangat unik berdasarkan waktu milidetik
        const seedValue = Math.floor(Date.now() + Math.random() * 1000000);
        
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            category, 
            attendanceType, 
            seed: seedValue 
          }),
        });
        
        const data = await response.json();
        if (response.ok && data && data.quote) {
          setQuote(data);
        } else {
          throw new Error('AI_FAILURE');
        }
      } catch (e: any) {
        const roleKey = (category || 'default').toLowerCase();
        const fallbackList = FALLBACK_QUOTES[roleKey] || FALLBACK_QUOTES.default;
        setQuote(fallbackList[Math.floor(Math.random() * fallbackList.length)]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuote();
  }, [category, attendanceType]);

  return (
    <div className="mt-2 pt-4 border-t border-border/10">
      <div className="flex items-center justify-center text-[9px] font-bold mb-3 text-muted-foreground/60 uppercase tracking-[0.2em]">
        <Sparkles className="h-3 w-3 mr-2 animate-pulse" />
        Kutipan Hari Ini
      </div>
      <div className="text-center min-h-[70px] flex flex-col items-center justify-center px-2">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-widest">Memuat kutipan...</span>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out w-full space-y-3">
            <blockquote className="font-bold text-[13px] text-foreground/90 leading-relaxed italic text-center px-1">
              "{quote?.quote}"
            </blockquote>
            <p className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/40">
              — AI E-SPENLI
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteOfTheDay;
