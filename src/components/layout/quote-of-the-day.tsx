'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

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

  useEffect(() => {
    if (!category || !attendanceType) {
      setIsLoading(false);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: category,
            attendanceType: attendanceType,
          }),
        });
        
        if (!response.ok) {
          throw new Error('API Response Error');
        }

        const data = await response.json();

        if (data.quote && data.author) {
          setQuote(data);
        } else {
          throw new Error('Invalid Data Format');
        }
      } catch (e: any) {
        // Silent error to prevent console spam as requested
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();

  }, [category, attendanceType]);

  return (
    <div className="mt-6 pt-4 border-t border-primary/10">
      <div className="flex items-center justify-center text-xs font-bold mb-3 text-primary/70">
        <Sparkles className="h-3.5 w-3.5 mr-2" />
        Motivasi Hari Ini
      </div>
      <div className="text-center text-sm min-h-[60px] flex items-center justify-center px-2">
        {isLoading ? (
          <div className="flex items-center text-muted-foreground/60">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Mencari inspirasi...
          </div>
        ) : error ? (
            <p className="text-muted-foreground/50 italic">Tetap semangat dan jaga kesehatan!</p>
        ) : quote ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <blockquote className="italic font-medium text-foreground/90">
              <p>"{quote.quote}"</p>
            </blockquote>
            <cite className="block text-right mt-1.5 text-[10px] font-bold text-primary/60">- {quote.author}</cite>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default QuoteOfTheDay;