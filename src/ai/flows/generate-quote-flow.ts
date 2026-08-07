'use server';
/**
 * @fileOverview AI Flow Modular Fragment-Based.
 * Menggunakan independent hashing untuk memastikan Hook, Context, dan Punchline selalu acak secara independen.
 * AI bertugas merangkai fragmen dan menambahkan satu bait pantun jenaka sekolah.
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
  "Laporan dari meja piket:", "Investigasi ruang guru menemukan:", "Fakta unik hari ini:", 
  "Misteri terungkap:", "Breaking news internal:", "Satu rahasia kecil:", 
  "Analisis teknis menunjukkan:", "Catatan di balik buku nilai:", "Bisikan di koridor:", 
  "Observasi pagi ini:", "Kabar burung dari kantin:", "Hasil sinkronisasi batin:", 
  "Filosofi spidol habis:", "Drama administrasi hari ini:", "Instruksi dari alam bawah sadar:",
  "Menurut pakar kursi plastik:", "Teori konspirasi printer:", "Hikmah di balik RPP:",
  "Pesan dari proyektor:", "Ramalan cuaca sekolah:", "Berita singkat:", 
  "Logika komputer sekolah:", "Saran dari server:", "Memo tidak resmi:",
  "Dialog batin hari ini:", "Suasana di tata usaha:", "Peringatan dini:",
  "Informasi dari grup WA:", "Review jujur:", "Kutipan tersembunyi:",
  "Temuan di balik tirai:", "Status terkini:", "Analisis mendalam:", "Catatan pinggir:"
];

const contexts = [
  "kabel proyektor yang melilit seperti perasaan", "sinyal WiFi yang segan hidup mati tak mau",
  "aroma nasi kuning yang menggoda iman", "tumpukan kertas ujian yang minta dielus",
  "printer yang mendadak mogok pas jam kritis", "Dapodik yang belum sinkron sejak fajar",
  "bel sekolah yang bunyinya terlalu puitis", "pulpen pilot yang sering berkelana sendiri",
  "laptop yang mendadak update Windows", "antrean fotokopi soal yang mengular",
  "kapur tulis yang patah hati", "kursi plastik yang retak seribu",
  "tinta merah yang meluap di buku nilai", "kunci lemari arsip yang main petak umpet",
  "siswa yang lupa bawa PR tapi ingat menu kantin", "hujan gerimis yang bikin ngantuk di kelas",
  "rapat dinas yang sebenarnya bisa jadi email", "kuota internet yang habis pas zoom meeting",
  "baterai laptop yang drop tanpa permisi", "meja guru yang penuh tumpukan harta karun",
  "ritual minum teh yang tertunda", "sertifikasi yang masih berupa mitos",
  "piket pagi yang berujung sarapan", "seragam batik yang motifnya penuh filosofi",
  "spidol yang tintanya memudar perlahan", "air galon yang habis di saat haus",
  "stapler yang dipinjam tapi lupa jalan pulang", "proyektor yang menyala sekali klik",
  "ruangan yang baru dipel wanginya menenangkan", "suasana tenang sebelum siswa datang",
  "suara gesekan kursi di kelas sebelah", "antrean air minum di dispenser"
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
  "pastikan jiwa tetap sinkron.", "lebih penting daripada absen manual.",
  "adalah hukum alam di sekolah ini.", "tetap tenang dan teruskan berkarya.",
  "memang misteri yang belum terpecahkan.", "hanya terjadi di SMPN 5.",
  "mari kita rayakan dengan makan siang.", "setidaknya printer tidak meledak.",
  "masih lebih baik daripada ban bocor.", "untung sarapan tadi pagi cukup.",
  "mari kita buat jadi cerita lucu besok.", "inilah dinamika dunia pendidikan kita.",
  "sangat berkesan untuk diceritakan.", "mari kita mulai dengan bismillah."
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
    // 1. GABUNGKAN SEMUA DIMENSI SEED
    const fullSeed = `${input.userId}|${input.date}|${input.day}|${input.attendanceType}|${input.creativeSeed}`;
    
    // 2. INDEPENDENT HASHING UNTUK SETIAP FRAGMEN
    const hookHash = getHash(fullSeed + "|hook-salt");
    const contextHash = getHash(fullSeed + "|context-salt");
    const punchHash = getHash(fullSeed + "|punch-salt");
    
    const selectedHook = hooks[hookHash % hooks.length];
    const selectedContext = contexts[contextHash % contexts.length];
    const selectedPunchline = punchlines[punchHash % punchlines.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.2, // Sedikit diturunkan dari 1.5 agar lebih stabil namun tetap kreatif
          topP: 0.95,
          maxOutputTokens: 500,
        },
        system: `Anda adalah perangkai kata yang humoris di SMPN 5 Langke Rembong.
TUGAS: 
1. Sambungkan tiga fragmen narasi berikut menjadi SATU paragraf pembuka yang alami.
2. Di bawah paragraf tersebut, tambahkan SATU bait Pantun Jenaka (4 baris, rima a-b-a-b) yang lucu bertema pendidikan atau sekolah.

FRAGMEN WAJIB (URUTAN TIDAK BOLEH BERUBAH):
1. Hook: "${selectedHook}"
2. Context: "${selectedContext}"
3. Punchline: "${selectedPunchline}"

ATURAN MUTLAK:
1. JANGAN MENGUBAH satu kata pun dari isi Hook, Context, dan Punchline.
2. JANGAN MENGUBAH urutan fragmen. Harus: [Hook] -> [Context] -> [Punchline].
3. Sambungkan ketiganya menggunakan kata tambahan agar mengalir.
4. Buat PANTUN di bawah paragraf pembuka. Pantun harus terdiri dari 4 baris dengan rima akhir a-b-a-b.
5. JANGAN gunakan emoji.
6. JANGAN gunakan kata: "Semangat", "Masa Depan", "Sukses".
7. Masukkan nama "AI E-SPENLI" pada kolom author.`,
        prompt: `Rangkai secara alami: [${selectedHook}] [${selectedContext}] [${selectedPunchline}]. 
        Lalu tambahkan pantun lucu untuk ${input.userName} yang berperan sebagai ${input.role} saat melakukan absen ${input.attendanceType === 'in' ? 'masuk' : 'pulang'}.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_FLOW_ERROR]:', err.message);
      return {
        quote: `${selectedHook} ${selectedContext} ${selectedPunchline}\n\nPergi ke pasar beli kuaci,\nBeli juga satu tangkai bunga.\nMari kerja dengan hati,\nAgar lelah jadi bahagia.`,
        author: "AI E-SPENLI"
      };
    }
  }
);