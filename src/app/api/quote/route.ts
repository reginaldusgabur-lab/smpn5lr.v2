import { getQuote } from '@/ai/flows/quoteFlow';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  console.log('\n--- [START] Memulai permintaan /api/quote ---');
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'general';
    console.log(`[INFO] Kategori yang diterima: ${category}`);

    console.log('[INFO] Memanggil fungsi getQuote...');
    const quote = await getQuote(category);
    console.log('[SUCCESS] Fungsi getQuote berhasil mengembalikan hasil.');

    if (!quote || !quote.quote) {
      console.error('[ERROR] Kutipan yang dihasilkan AI kosong atau tidak valid.');
      throw new Error('Kutipan yang dihasilkan kosong atau tidak valid.');
    }

    console.log('[INFO] Mengirim kutipan yang berhasil ke klien...');
    return NextResponse.json(quote);
  } catch (error) {
    // BLOK INI AKAN MENUNJUKKAN ERROR YANG SEBENARNYA
    console.error('\n--- !!! TERJADI ERROR DI /api/quote !!! ---');
    console.error('\n[PESAN ERROR ASLI DARI SERVER]:', error);
    console.error('\n------------------------------------------\n');
    
    return new NextResponse('Gagal menghasilkan kutipan', { status: 500 });
  }
}
