'use server';
/**
 * @fileOverview AI Flow Modular Fragment-Based (Compact Version).
 * Menghasilkan satu kalimat humor singkat seputar sekolah tanpa pantun.
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

function getHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  return Math.abs(hash);
}

const hooks = [
  "Laporan dari meja piket:", "Investigasi ruang guru:", "Fakta unik hari ini:", 
  "Misteri terungkap:", "Satu rahasia kecil:", "Analisis teknis:", 
  "Bisikan di koridor:", "Observasi pagi:", "Kabar burung kantin:", 
  "Filosofi spidol:", "Drama administrasi:", "Logika sekolah:",
  "Teori konspirasi printer:", "Hikmah RPP:", "Pesan proyektor:", 
  "Review jujur:", "Status terkini:", "Catatan pinggir:"
];

const contexts = [
  "kabel proyektor yang melilit seperti perasaan", "sinyal WiFi yang segan hidup mati tak mau",
  "aroma nasi kuning yang menggoda iman", "tumpukan kertas ujian yang minta dielus",
  "printer yang mendadak mogok pas jam kritis", "Dapodik yang belum sinkron sejak fajar",
  "bel sekolah yang bunyinya terlalu puitis", "pulpen pilot yang sering berkelana sendiri",
  "laptop yang mendadak update Windows", "antrean fotokopi soal yang mengular",
  "siswa yang lupa bawa PR tapi ingat menu kantin", "hujan gerimis yang bikin ngantuk di kelas",
  "rapat dinas yang sebenarnya bisa jadi email", "kuota internet yang habis pas zoom meeting",
  "baterai laptop yang drop tanpa permisi", "meja guru yang penuh tumpukan harta karun",
  "spidol yang tintanya memudar perlahan", "air galon yang habis di saat haus",
  "stapler yang dipinjam tapi lupa jalan pulang", "suara gesekan kursi di kelas sebelah"
];

const punchlines = [
  "memang ujian kesabaran tingkat tinggi.", "adalah seni dalam mendidik.",
  "lebih menantang daripada soal matematika.", "butuh kopi hitam tanpa gula.",
  "membuat hari ini semakin berwarna.", "adalah definisi kebahagiaan sederhana.",
  "jangan dibawa serius, bawa ketawa saja.", "lebih baik daripada dengerin gosip.",
  "pertanda hari ini akan sangat sibuk.", "untung bel pulang selalu setia menanti.",
  "seperti perasaan yang tak terbalas.", "memang butuh kesabaran ekstra.",
  "adalah bagian dari petualangan mengajar.", "mari kita hadapi dengan senyum tipis.",
  "setidaknya kita sudah berusaha maksimal.", "lebih seru daripada nonton sinetron.",
  "memang tidak ada di dalam kurikulum.", "segera tarik napas panjang.",
  "pastikan jiwa tetap sinkron.", "hanya terjadi di SMPN 5."
];

const fallbackQuotes = [
  "Tetap tenang, printer mogok adalah cara alam menyuruh kita istirahat sejenak.",
  "WiFi sekolah mungkin lambat, tapi semangat mengajar kita harus tetap 4G.",
  "Absen sudah sukses, sisa hari ini tinggal menghadapi kenyataan dan tumpukan koreksian.",
  "Ingat, bel pulang adalah musik paling merdu yang pernah diciptakan manusia."
];

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
    const fullSeed = `${input.userId}|${input.date}|${input.day}|${input.attendanceType}|${input.creativeSeed}`;
    
    const hookHash = getHash(fullSeed + "|hook-salt");
    const contextHash = getHash(fullSeed + "|context-salt");
    const punchHash = getHash(fullSeed + "|punch-salt");
    
    const selectedHook = hooks[hookHash % hooks.length];
    const selectedContext = contexts[contextHash % contexts.length];
    const selectedPunchline = punchlines[punchHash % punchlines.length];
    const selectedFallback = fallbackQuotes[hookHash % fallbackQuotes.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.1,
          maxOutputTokens: 100,
        },
        system: `Anda adalah perangkai kata yang humoris di SMPN 5 Langke Rembong.
TUGAS: 
Gabungkan tiga fragmen narasi berikut menjadi SATU kalimat pendek yang lucu, mengalir alami, dan santai. 
JANGAN membuat pantun. JANGAN menggunakan baris baru (newline). Cukup satu baris kalimat saja.

FRAGMEN WAJIB:
1. Hook: "${selectedHook}"
2. Context: "${selectedContext}"
3. Punchline: "${selectedPunchline}"

ATURAN:
1. Maksimal 20 kata.
2. JANGAN gunakan emoji.
3. JANGAN gunakan kata: "Semangat", "Masa Depan", "Sukses".
4. Masukkan nama "AI E-SPENLI" pada kolom author.`,
        prompt: `Rangkai fragmen ini menjadi satu kalimat lucu untuk ${input.userName} (${input.role}): [${selectedHook}] [${selectedContext}] [${selectedPunchline}].`,
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
