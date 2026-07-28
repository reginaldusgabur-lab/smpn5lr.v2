import { NextResponse } from 'next/server';
import { generateQuote } from '@/ai/flows/generate-quote-flow';

/**
 * API Route untuk menghasilkan kutipan motivasi menggunakan AI.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validasi parameter wajib sesuai skema baru
    const required = ['userName', 'userId', 'role', 'attendanceType', 'day', 'date', 'creativeSeed'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing parameter: ${field}` }, { status: 400 });
      }
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
