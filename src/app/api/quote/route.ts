
import { NextResponse } from 'next/server';
import { generateQuote } from '@/ai/flows/generate-quote-flow';

/**
 * API Route untuk menghasilkan kutipan motivasi menggunakan AI.
 * Audit Fix: Menambahkan logging untuk memastikan parameter yang dikirim dari klien sudah benar.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validasi parameter wajib sesuai skema baru
    const required = ['userName', 'userId', 'role', 'attendanceType', 'day', 'date', 'creativeSeed'];
    for (const field of required) {
      if (!body[field]) {
        console.error(`[API_QUOTE_ERROR] Missing field: ${field}`);
        return NextResponse.json({ error: `Missing parameter: ${field}` }, { status: 400 });
      }
    }

    // Panggil fungsi AI Flow
    const result = await generateQuote(body);
    
    // Pastikan header tidak menyebabkan cache di tingkat browser
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('[API_QUOTE_FAILURE]:', error);
    
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
