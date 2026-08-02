'use server';
/**
 * @fileOverview AI Flow Fragment-Based Deterministik.
 * Aplikasi menentukan kerangka kalimat (Hook, Context, Punchline), AI hanya merangkai.
 * Menghasilkan variasi jutaan kombinasi untuk menghindari normalisasi model.
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
  "Informasi dari grup WA:", "Review jujur:", "Kutipan tersembunyi:"
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
  "ruangan yang baru dipel wanginya menenangkan", "suasana tenang sebelum siswa datang"
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
  "mari kita buat jadi cerita lucu besok.", "inilah dinamika dunia pendidikan kita."
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
    // MULTI-DIMENSIONAL DETERMINISTIC SELECTION
    const fullSeed = `${input.userId}|${input.date}|${input.day}|${input.attendanceType}|${input.creativeSeed}`;
    const baseHash = getHash(fullSeed);
    
    // Pilih fragmen secara deterministik menggunakan bit-shifting agar tidak saling terkait
    const selectedHook = hooks[baseHash % hooks.length];
    const selectedContext = contexts[(baseHash >> 2) % contexts.length];
    const selectedPunchline = punchlines[(baseHash >> 4) % punchlines.length];

    // AUDIT LOGGING UNTUK VERIFIKASI KEUNIKAN
    console.log(`[AI_AUDIT] User: ${input.userName} | Hash: ${baseHash} | Role: ${input.role}`);
    console.log(`[AI_AUDIT_FRAGMENTS] Hook: ${selectedHook} | Context: ${selectedContext} | Punchline: ${selectedPunchline}`);

    const roleLabel = input.role.replace('_', ' ');
    const stateLabel = input.attendanceType === 'in' ? 'awal tugas' : 'akhir tugas';

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.4, // Menaikkan suhu untuk variasi bahasa
          topP: 0.9,
          maxOutputTokens: 200,
        },
        system: `Anda adalah asisten humoris di SMPN 5 Langke Rembong.
TUGAS: Gabungkan tiga fragmen narasi berikut menjadi SATU kutipan yang sangat alami, pendek (maks 2 kalimat), dan lucu.
FRAGMEN WAJIB:
- Hook: "${selectedHook}"
- Context: "${selectedContext}"
- Punchline: "${selectedPunchline}"

ATURAN KETAT:
1. JANGAN gunakan kata: "Semangat", "Menyerah", "Sukses", "Masa Depan".
2. Jangan mengulang kata-kata formal. 
3. Sesuaikan sedikit dengan profil: ${input.userName} (${roleLabel}) saat ${stateLabel}.
4. JANGAN gunakan emoji.
5. Hasil harus terasa seperti obrolan di sekolah, bukan pidato.`,
        prompt: `Rangkai fragmen ini: [${selectedHook}] [${selectedContext}] [${selectedPunchline}]. 
        Pastikan kutipan terasa personal untuk ${input.userName}.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_FLOW_ERROR]:', err.message);
      throw err;
    }
  }
);
