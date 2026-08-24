'use server';
/**
 * @fileOverview AI Flow untuk menghasilkan kutipan motivasi yang random, humoris, dan luas.
 * Fokus pada dunia pendidikan dan kerja secara umum agar tidak membosankan.
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
 * Kutipan cadangan yang lebih humoris dan general tentang dunia kerja/pendidikan.
 */
const fallbacks = {
  in: [
    "Pagi! Ingat, kopi pertama hari ini adalah investasi masa depan, sisanya baru pengabdian.",
    "Semangat mengajar! Ingat, murid yang paling bandel biasanya yang paling ingat jasa kita pas udah sukses nanti.",
    "Kerja itu ibadah, tapi kalau liat tanggal tua emang butuh kesabaran ekstra. Yuk, senyum dulu!",
    "Awali pagi dengan optimis. Kalau spidol habis, anggap saja itu kode alam buat istirahat sebentar.",
    "Jadi guru itu keren. Kita satu-satunya profesi yang ditanya 'Pak, halaman berapa?' padahal udah ditulis segede gaban di papan tulis."
  ],
  out: [
    "Pulang! Lepaskan beban pikiran, tapi jangan lepaskan kunci motor di laci meja ya.",
    "Perjuangan hari ini tuntas. Selamat beristirahat, biarkan mimpi indah menggantikan daftar nilai yang belum selesai.",
    "Baterai HP boleh 5%, tapi semangat pulang harus tetap 100%. Hati-hati di jalan!",
    "Terima kasih atas dedikasinya hari ini. Rebahan sudah menunggumu dengan tangan terbuka lebar.",
    "Keluar dari gerbang sekolah adalah kemenangan kecil. Ingat, besok masih ada petualangan baru!"
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
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.2, // Menaikkan kreativitas agar tidak membosankan
          maxOutputTokens: 150,
        },
        system: `Anda adalah stand-up comedian yang merangkap jadi motivator pendidikan paling hits.
TUGAS: Buat SATU kutipan (quote) yang lucu, segar, "relate" banget sama guru/staf, dan tetap inspiratif.
TEMA: Dunia pendidikan, perjuangan di kelas, suka duka admin sekolah, dan kehidupan kerja secara umum.

ATURAN MAIN:
1. JANGAN terus-terusan nyebut "SMPN 5" atau "Langke Rembong". Fokus ke esensi profesi mereka (Guru, Staf, Pekerja).
2. Jika ABSEN MASUK: Kasih semangat yang dibumbui humor (tentang kopi, semangat pagi, atau menghadapi murid/tugas).
3. Jika ABSEN PULANG: Kasih ucapan selamat istirahat yang lucu (tentang rebahan, lupakan cicilan sebentar, atau macetnya jalan).
4. Gaya bahasa santai tapi tetap berkelas (Quotes gaya sosmed).
5. Maksimal 25 kata. JANGAN gunakan emoji. JANGAN buat pantun.
6. Pastikan setiap hasil BERBEDA (Random) dan sangat unik.`,
        prompt: `Buat satu kutipan eksklusif dan humoris untuk ${input.userName} (${input.role}) yang baru saja absen ${isEntry ? 'masuk pagi' : 'pulang sore'}. Seed: ${input.creativeSeed}`,
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
