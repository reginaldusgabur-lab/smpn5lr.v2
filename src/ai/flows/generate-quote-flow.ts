'use server';
/**
 * @fileOverview Alur kerja untuk menghasilkan kutipan motivasi dan humor harian menggunakan GenAI.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const QuoteInputSchema = z.object({
  category: z.string().describe('Peran pengguna (kepala_sekolah, guru, pegawai, admin)'),
  attendanceType: z.enum(['in', 'out']).describe('Tipe absensi (in untuk masuk, out untuk pulang)'),
});

const QuoteOutputSchema = z.object({
  quote: z.string().describe('Kalimat motivasi atau humor pendek'),
  author: z.string().describe('Nama tokoh, sebutan tim, atau sumber berita fiktif'),
});

export async function generateQuote(input: z.infer<typeof QuoteInputSchema>) {
  return generateQuoteFlow(input);
}

const generateQuoteFlow = ai.defineFlow(
  {
    name: 'generateQuoteFlow',
    inputSchema: QuoteInputSchema,
    outputSchema: QuoteOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: `Anda adalah motivator dan pelawak cerdas untuk lingkungan SMPN 5 Langke Rembong. 
      Berikan satu kutipan unik dalam Bahasa Indonesia untuk seseorang dengan peran ${input.category} 
      yang baru saja melakukan absen ${input.attendanceType === 'in' ? 'MASUK (Pagi hari)' : 'PULANG (Sore hari)'}.

      KETENTUAN KONTEN:
      1. TEMA ACAK: Pilih secara acak antara: Motivasi pendidikan, Inspirasi, Kata bijak, Humor ringan, Pantun lucu, Semangat bekerja, Kebersamaan, Disiplin, atau Gosip lucu (fiktif).
      2. GAYA ACAK: Pilih gaya: Inspiratif, Bijak, Lucu, Pantun, Satir ringan, Gosip bergaya berita (Info Viral/Breaking News), Pengumuman absurd, atau Fakta "katanya".
      3. GOSIP FIKTIF: Jika memilih tema gosip, buatlah berita lucu tentang benda mati atau situasi kantor (misal: "📰 Info Viral: Kursi ruang guru mengaku kangen karena pemiliknya belum sempat duduk sejak pagi"). JANGAN sebut nama orang asli, JANGAN mengandung fitnah, SARA, atau politik.
      4. KONTEKS WAKTU:
         - Jika MASUK: Berikan semangat, candaan pagi, atau energi positif untuk memulai hari.
         - Jika PULANG: Berikan apresiasi kerja keras, ucapan terima kasih, atau humor santai pelepas lelah.
      5. FORMAT: Kalimat harus natural, menarik, dan maksimal 18 kata.

      Berikan output bervariasi setiap kali diminta agar tidak monoton.`,
      output: { schema: QuoteOutputSchema },
    });

    // Fallback jika AI gagal (sangat jarang terjadi)
    if (!output || !output.quote) {
      return {
        quote: "Tetap semangat dan jaga kesehatan, karena senyummu adalah energi bagi sekolah kita!",
        author: "Tim E-SPENLI"
      };
    }

    return output;
  }
);
