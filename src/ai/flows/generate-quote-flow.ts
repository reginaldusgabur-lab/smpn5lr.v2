'use server';
/**
 * @fileOverview AI Flow untuk menghasilkan kutipan motivasi yang SANGAT UNIK per pengguna.
 * Menggunakan identitas unik pengguna (userId & userName) untuk menjamin variasi yang berbeda 
 * antar personil meskipun pada hari dan status absen yang sama.
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
 * Kutipan cadangan berbasis hash untuk menjamin keunikan 
 * bahkan saat kondisi offline atau kegagalan API AI.
 */
const fallbacks = {
  in: [
    "Pagi adalah awal baru untuk jiwa yang ikhlas mendidik. Semangat menyinari kelas!",
    "Kopi pagi ini adalah doa, pengabdian adalah ibadah. Selamat bertugas.",
    "Setiap murid adalah kanvas kosong, jadilah kuas yang memberi warna hari ini.",
    "Dedikasi Anda adalah pondasi masa depan mereka. Mari menyapa kelas dengan senyum.",
    "Tantangan hari ini adalah peluang untuk memberi inspirasi. Selamat mengabdi."
  ],
  out: [
    "Tuntas sudah perjuangan hari ini. Waktunya pulang dan mengisi ulang energi.",
    "Istirahatlah dengan tenang, keluarga menanti cerita hebat Anda di rumah.",
    "Beban kerja tuntas, kehangatan keluarga menunggu. Hati-hati di jalan.",
    "Terima kasih atas ketulusan Anda mengabdi hari ini. Selamat bersantai.",
    "Besok adalah petualangan baru, sore ini adalah kemenangan untuk diri sendiri."
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
    
    // Tentukan Persona berdasarkan Hash untuk variasi radikal
    const personas = [
      "Filosof Stoik (fokus pada ketenangan, logika, dan tugas mulia)",
      "Penyair Kontemporer (fokus pada metafora alam, cahaya, dan harmoni)",
      "Arsitek Visi (fokus pada struktur, pondasi masa depan, dan presisi)",
      "Rekan Energik (fokus pada antusiasme, keceriaan, dan aksi nyata)",
      "Navigator Bijak (fokus pada arah, kompas moral, dan perjalanan ilmu)"
    ];
    const selectedPersona = personas[hash % personas.length];

    const fallbackList = isEntry ? fallbacks.in : fallbacks.out;
    const selectedFallback = fallbackList[hash % fallbackList.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.5,
          topP: 0.98,
          topK: 65,
          maxOutputTokens: 250,
        },
        system: `Anda adalah "E-SPENLI Muse", generator kutipan yang sangat personal dan anti-mainstream.
TUGAS: Buat SATU kutipan pendek (15-22 kata) yang disesuaikan khusus untuk individu ini.

GAYA BAHASA SAAT INI: Anda harus menulis sebagai "${selectedPersona}".

STRATEGI ANTI-REPETISI:
1. Gunakan ${input.userId} dan ${input.creativeSeed} sebagai jangkar keunikan.
2. JANGAN memulai kalimat dengan kata standar seperti "Setiap", "Hari ini", "Mari", atau "Jadilah".
3. Eksplorasi metafora dari domain: Astronomi, Navigasi Laut, Tenun Tradisional, Arsitektur, atau Simfoni.
4. KONTEKS PERAN:
   - Kepala Sekolah (${input.role}): Fokus pada kemudi, integritas, dan orkestrasi sekolah.
   - Guru (${input.role}): Fokus pada percikan rasa ingin tahu, arsitektur mimpi, dan keteladanan.
   - Pegawai (${input.role}): Fokus pada roda efisiensi, detak jantung sistem, dan profesionalisme.

DAFTAR TERLARANG (JANGAN GUNAKAN):
- "Pahlawan tanpa tanda jasa", "Masa depan bangsa", "Semangat pagi", "Pantang menyerah", "Teruslah melangkah".

ATURAN KETAT:
- Tanpa emoji. Tanpa pantun. Tanpa sajak berima.
- Pastikan kalimat terasa segar, tajam, dan hanya masuk akal untuk pengguna ini hari ini.`,
        prompt: `PARAMETER UNIK:
- Nama: ${input.userName}
- ID Benih: ${input.userId}
- Sesi: ${isEntry ? 'Masuk (Fajar/Mulai)' : 'Masuk (Senja/Selesai)'}
- Tanggal: ${input.date}
- Varian Entropi: ${input.creativeSeed}

Buat kalimat yang belum pernah Anda buat sebelumnya. Pastikan kutipan untuk ${input.userName} berbeda total dengan kutipan orang lain.`,
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
