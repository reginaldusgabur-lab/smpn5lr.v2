'use server';
/**
 * @fileOverview Alur kerja untuk menghasilkan kutipan motivasi harian.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const QuoteInputSchema = z.object({
  category: z.string().describe('Peran atau kategori pengguna (admin, guru, pegawai, siswa, kepala_sekolah)'),
  attendanceType: z.enum(['in', 'out']).describe('Tipe absensi (in untuk masuk, out untuk pulang)'),
});

const QuoteOutputSchema = z.object({
  quote: z.string().describe('Kalimat motivasi pendek dalam Bahasa Indonesia'),
  author: z.string().describe('Nama tokoh atau "Tim E-SPENLI"'),
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
      prompt: `Anda adalah asisten motivator cerdas untuk SMPN 5 Langke Rembong. 
      Berikan kutipan motivasi yang singkat, padat, dan sangat menyemangati (maksimal 12 kata) dalam Bahasa Indonesia.
      Kutipan ditujukan untuk seseorang dengan peran ${input.category} yang baru saja melakukan absen ${input.attendanceType === 'in' ? 'masuk sekolah' : 'pulang kerja/sekolah'}.
      Jika absen masuk, berikan semangat memulai hari. Jika absen pulang, berikan apresiasi atas kerja keras hari ini.`,
      output: { schema: QuoteOutputSchema },
    });
    return output!;
  }
);