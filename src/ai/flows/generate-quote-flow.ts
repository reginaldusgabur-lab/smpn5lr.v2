'use server';
/**
 * @fileOverview AI Flow untuk menghasilkan kutipan motivasi yang kontekstual dan bermakna.
 * Mengatasi masalah ketidaksambungan antara jenis absen dan isi kutipan.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const QuoteInputSchema = z.object({
  userName: z.string(),
  userId: z.string(),
  role: z.string(),
  attendanceType: z.enum(['in', 'out']),
  day: z.string(),
  date: z.string(),
  creativeSeed: z.string(),
});

const QuoteOutputSchema = z.object({
  quote: z.string(),
  author: z.string(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

/**
 * Kutipan cadangan yang dipisahkan secara ketat berdasarkan jenis absen.
 */
const fallbacks = {
  in: [
    "Awali pagi dengan senyuman, cerahkan masa depan anak bangsa di SMPN 5.",
    "Semangat pagi! Mari kita buat sejarah baru di dalam kelas hari ini.",
    "Pagi yang cerah di Manggarai, saatnya berbagi ilmu dan inspirasi mulia.",
    "Siapkan energi positif Anda, mari hadapi hari dengan penuh dedikasi."
  ],
  out: [
    "Tugas mulia hari ini tuntas, saatnya rehat dan kumpulkan tenaga.",
    "Pulanglah dengan bangga, Anda telah menanam benih masa depan hari ini.",
    "Baterai boleh habis, tapi dedikasi Anda akan selalu membekas di hati murid.",
    "Selamat beristirahat, biarkan lelahmu menjadi keberkahan yang melimpah."
  ]
};

function getHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  return Math.abs(hash);
}

export async function generateQuote(input: QuoteInput): Promise<QuoteOutput> {
  return generateQuoteFlow(input);
}

const generateQuoteFlow = ai.defineFlow(
  {
    name: 'generateQuoteFlow',
    inputSchema: QuoteInputSchema,
    outputSchema: QuoteOutputSchema,
  },
  async (input) => {
    const isEntry = input.attendanceType === 'in';
    const hash = getHash(`${input.userId}|${input.date}|${input.creativeSeed}`);
    
    // Pilih fallback yang sesuai dengan konteks absen
    const fallbackList = isEntry ? fallbacks.in : fallbacks.out;
    const selectedFallback = fallbackList[hash % fallbackList.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.0,
          maxOutputTokens: 150,
        },
        system: `Anda adalah perangkai kata yang bijak dan motivator ulung di SMPN 5 Langke Rembong (E-SPENLI).
TUGAS: Buat satu kutipan (quote) motivasi yang mendalam, bermakna, dan sangat relevan dengan situasi sekolah.
KONTEKS: Pengguna bernama ${input.userName} (${input.role}) baru saja melakukan absen ${isEntry ? 'MASUK' : 'PULANG'}.

ATURAN PENULISAN:
1. Jika ABSEN MASUK: Fokus pada semangat pagi, visi mengajar, dan energi positif memulai hari.
2. Jika ABSEN PULANG: Fokus pada apresiasi kerja keras hari ini, rasa syukur, dan ucapan selamat beristirahat.
3. Gaya bahasa harus terlihat seperti "Quotes" profesional, bukan sekadar kalimat perintah.
4. Maksimal 25 kata. JANGAN gunakan emoji. JANGAN buat pantun.
5. Pastikan isi kutipan nyambung dengan waktu ${isEntry ? 'pagi (mulai kerja)' : 'sore (selesai kerja)'}.`,
        prompt: `Buat satu kutipan eksklusif untuk ${input.userName} yang sedang absen ${isEntry ? 'masuk pagi' : 'pulang sore'}.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_FLOW_ERROR]:', err.message);
      return {
        quote: selectedFallback,
        author: "AI E-SPENLI"
      };
    }
  }
);
