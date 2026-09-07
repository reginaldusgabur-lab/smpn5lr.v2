
'use server';
/**
 * @fileOverview AI Flow untuk menghasilkan kutipan motivasi yang SANGAT UNIK per pengguna.
 * Menggunakan kombinasi ID Pengguna (userId), Nama, Tanggal, dan Seed Kreatif (creativeSeed) 
 * untuk menjamin variasi yang berbeda antar personil pada hari yang sama.
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
 * Kutipan cadangan (fallback) berbasis hash untuk menjamin keunikan 
 * bahkan saat kondisi offline atau kegagalan API AI.
 */
const fallbacks = {
  in: [
    "Kopi pertama adalah doa, mengajar adalah ibadah. Semangat menyinari kelas!",
    "Setiap pagi adalah kesempatan untuk menjadi inspirasi bagi murid-murid Anda.",
    "Dedikasi Anda hari ini adalah pondasi masa depan mereka. Selamat mengabdi.",
    "Awali dengan senyum, akhiri dengan kepuasan telah berbagi ilmu.",
    "Pagi yang cerah untuk jiwa-jiwa yang ikhlas mendidik. Selamat bertugas!"
  ],
  out: [
    "Tuntas sudah perjuangan hari ini. Waktunya mengisi ulang energi di rumah.",
    "Istirahatlah dengan tenang, besok dunia butuh semangat Anda kembali.",
    "Hati-hati di jalan, keluarga tercinta menanti cerita hebat Anda hari ini.",
    "Satu hari luar biasa telah terlewati. Terima kasih atas ketulusan Anda.",
    "Rebahan adalah apresiasi terbaik untuk diri sendiri sore ini. Selamat bersantai!"
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
    
    // Logika hash untuk memastikan fallback pun tetap unik per user
    const hash = getHash(`${input.userId}|${input.date}|${input.creativeSeed}`);
    const fallbackList = isEntry ? fallbacks.in : fallbacks.out;
    const selectedFallback = fallbackList[hash % fallbackList.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.5, // Meningkatkan kreativitas maksimal untuk variasi kata
          topP: 0.95,
          topK: 60,
          maxOutputTokens: 300,
        },
        system: `Anda adalah "E-SPENLI Muse", generator kutipan yang SANGAT personal, cerdas, dan variatif. 
TUGAS: Buat SATU kutipan pendek (maks 25 kata) yang BENAR-BENAR UNIK untuk satu personil spesifik.

STRATEGI KEUNIKAN MUTLAK:
1. Gunakan ID UNIK (${input.userId}) dan NAMA (${input.userName}) sebagai benih (anchor) gaya bahasa Anda.
2. JANGAN gunakan pola kalimat yang sama untuk pengguna yang berbeda.
3. Eksplorasi berbagai nada secara acak: santai, puitis, motivasi stoik, jenaka (lucu), atau sangat formal.
4. Gunakan metafora yang berbeda setiap kali dipanggil (misal: tentang pelita, pelaut, kanvas, pahlawan sunyi, orkestra ilmu, dsb).
5. Konteks MASUK: Fokus pada semangat, kopi pagi, misi mendidik, atau tantangan baru.
6. Konteks PULANG: Fokus pada istirahat, kelegaan, apresiasi diri, dan kehangatan keluarga.
7. JANGAN MENYURUH ISTIRAHAT SAAT MASUK. JANGAN MENYURUH KERJA SAAT PULANG.

ATURAN KETAT:
- Jangan gunakan emoji.
- Jangan buat pantun atau puisi panjang.
- Fokus pada esensi profesi ${input.role} di sekolah.
- Pastikan kalimat terasa segar, baru, dan "HANYA" untuk pengguna tersebut.`,
        prompt: `BUAT KUTIPAN EKSKLUSIF DAN UNIK SEKARANG:
- Target Personil: ${input.userName}
- ID Keamanan Unik: ${input.userId}
- Waktu Sesi: ${isEntry ? 'Absen Masuk (Mulai)' : 'Absen Pulang (Selesai)'}
- Tanggal Berjalan: ${input.date}
- Token Variasi: ${input.creativeSeed}

Gunakan semua parameter di atas untuk meramu kalimat yang belum pernah Anda keluarkan sebelumnya. Pastikan kutipan untuk ${input.userName} berbeda dengan kutipan untuk orang lain di hari yang sama.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_QUOTE_FLOW_ERROR]:', err.message);
      return {
        quote: selectedFallback,
        author: "AI E-SPENLI"
      };
    }
  }
);
