import { NextResponse } from 'next/server';
import { generateQuote } from '@/ai/flows/generate-quote-flow';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateQuote(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API Quote Error:', error);
    return NextResponse.json(
      { message: 'Gagal menghasilkan kutipan motivasi' },
      { status: 500 }
    );
  }
}