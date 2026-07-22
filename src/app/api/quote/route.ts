import { NextResponse } from 'next/server';
import { generateQuote } from '@/ai/flows/generate-quote-flow';

/**
 * API Route untuk menghasilkan kutipan motivasi menggunakan AI.
 * Mengembalikan hasil dari alur kerja generateQuoteFlow.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validasi input minimal
    if (!body.category || !body.attendanceType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const result = await generateQuote(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SERVER_API_QUOTE_FAILURE:', error);
    
    return NextResponse.json(
      { 
        message: 'AI Implementation Error',
        error: error.message || 'Unknown Error',
        status: error.status || 500
      },
      { status: 500 }
    );
  }
}
