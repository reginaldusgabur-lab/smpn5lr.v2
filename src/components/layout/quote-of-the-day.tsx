
'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, Sparkles, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuoteOfTheDayProps {
  category: string | null | undefined;
  attendanceType: 'in' | 'out' | null;
}

interface Quote {
  quote: string;
  author: string;
}

const QuoteOfTheDay = ({ category, attendanceType }: QuoteOfTheDayProps) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const isFetched = useRef(false);

  useEffect(() => {
    if (!category || !attendanceType || isFetched.current) {
      if (!category || !attendanceType) setIsLoading(false);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(false);
      isFetched.current = true;
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, attendanceType }),
        });
        
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        if (data.quote) setQuote(data);
      } catch (e: any) {
        setError(true);
        setQuote({
          quote: attendanceType === 'in' ? "Awali hari dengan semangat dan senyuman, karena energi positif Anda adalah penggerak sekolah kita." : "Kerja kerasmu hari ini luar biasa. Sekarang waktunya istirahat dan berkumpul dengan keluarga.",
          author: "Tim E-SPENLI"
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuote();
  }, [category, attendanceType]);

  return (
    <div className="mt-4 pt-6 border-t border-white/5">
      <div className="flex items-center justify-center text-[10px] font-bold mb-4 text-white/40 uppercase tracking-[0.2em]">
        <Sparkles className="h-3 w-3 mr-2" />
        Kutipan Hari Ini
      </div>
      
      <div className="text-center min-h-[60px] flex items-center justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-white/20">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Inspirasi...</span>
          </div>
        ) : error ? (
           <p className="text-white/20 text-xs italic animate-in fade-in">Tetap semangat hari ini!</p>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out w-full">
            <blockquote className="font-bold text-sm text-white/90 leading-relaxed italic">
              "{quote?.quote}"
            </blockquote>
            <cite className="block text-right mt-3 text-[10px] font-bold text-white/40 not-italic">
              - {quote?.author.includes('Spenli') ? quote.author : `Sistem E-Spenli`}
            </cite>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteOfTheDay;
