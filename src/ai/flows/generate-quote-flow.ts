'use server';
/**
 * @fileOverview AI Flow Modular Fragment-Based (Enhanced Context Version).
 * Menghasilkan satu kalimat humor singkat yang mendeteksi jenis absen (Masuk/Pulang).
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

// FRAGMEN KHUSUS ABSEN MASUK (IN)
const inHooks = [
  "Misi pagi hari:", "Briefing fajar:", "Update status pagi:", "Energi fajar:", 
  "Visi hari ini:", "Observasi pagi:", "Laporan meja piket:", "Investigasi ruang guru:"
];

const inContexts = [
  "secangkir kopi yang masih mengepul", "papan tulis yang masih bersih mengkilap", 
  "semangat mengajar yang masih 100%", "antrean absen yang tertib dan damai", 
  "suara kicauan burung di lapangan sekolah", "daftar hadir yang masih kosong melompong",
  "udara pagi Manggarai yang menyejukkan jiwa", "tumpukan buku yang siap dibagikan"
];

const inPunchlines = [
  "mari kita buat sejarah di kelas hari ini.", "pastikan jiwa dan raga sudah sinkron.", 
  "hadapi murid dengan kesabaran tingkat tinggi.", "jangan lupa bahagia sebelum mengajar.", 
  "siapkan amunisi ilmu pengetahuan Anda.", "semoga hari ini berjalan sesuai RPP.",
  "tetap tenang, bel masuk segera berbunyi.", "ingat, Anda adalah pahlawan tanpa tanda jasa."
];

// FRAGMEN KHUSUS ABSEN PULANG (OUT)
const outHooks = [
  "Misi tuntas:", "Laporan akhir shift:", "Log out harian:", "Misi selesai:", 
  "Evaluasi sore:", "Catatan penutup:", "Status terkini:", "Kabar terakhir:"
];

const outContexts = [
  "baterai HP yang sudah masuk masa kritis", "tinta spidol yang habis berjuang di papan", 
  "otak yang sudah minta mode hemat daya", "senyum lebar saat melihat gerbang sekolah", 
  "bayangan bantal dan kasur yang melambai", "laptop yang mulai hangat seperti perasaan",
  "bel pulang yang bunyinya paling merdu", "langit sore yang indah di atas sekolah"
];

const outPunchlines = [
  "saatnya lupakan rumus matematika sejenak.", "rehat dulu, besok kita tempur lagi.", 
  "hadiahi diri sendiri dengan makan malam enak.", "biarkan RPP beristirahat di dalam tas.", 
  "selamat menikmati waktu bersama keluarga.", "tugas negara selesai, saatnya tugas rumah tangga.",
  "pastikan tidak ada barang tertinggal di laci.", "pulanglah dengan hati yang gembira."
];

const fallbackQuotes = [
  "Tetap tenang, hari ini adalah petualangan baru di SMPN 5.",
  "Absen sukses, sisa hari ini tinggal jalani dengan senyuman.",
  "Ingat, pendidikan adalah seni yang membutuhkan energi positif.",
  "Selamat beristirahat, kumpulkan tenaga untuk hari esok."
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
    const hash = getHash(fullSeed);

    const isEntry = input.attendanceType === 'in';
    
    const hooks = isEntry ? inHooks : outHooks;
    const contexts = isEntry ? inContexts : outContexts;
    const punchlines = isEntry ? inPunchlines : outPunchlines;

    const selectedHook = hooks[hash % hooks.length];
    const selectedContext = contexts[(hash >> 2) % contexts.length];
    const selectedPunchline = punchlines[(hash >> 4) % punchlines.length];
    const selectedFallback = fallbackQuotes[hash % fallbackQuotes.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.2,
          maxOutputTokens: 120,
        },
        system: `Anda adalah perangkai kata yang humoris dan bijak di SMPN 5 Langke Rembong.
TUGAS: 
Gabungkan tiga fragmen narasi berikut menjadi SATU kalimat pendek yang lucu dan santai sesuai jenis absen. 
PENTING: Kalimat harus terasa natural dan mengalir.

KONTEKS ABSEN: ${isEntry ? 'MASUK SEKOLAH (PAGI)' : 'PULANG SEKOLAH (SORE)'}.

FRAGMEN WAJIB:
1. Hook: "${selectedHook}"
2. Context: "${selectedContext}"
3. Punchline: "${selectedPunchline}"

ATURAN:
1. Maksimal 22 kata.
2. JANGAN gunakan emoji.
3. JANGAN buat pantun. Cukup satu baris kalimat.
4. Sesuaikan nada bicara untuk ${input.userName} dengan peran ${input.role}.`,
        prompt: `Buat kalimat lucu untuk ABSEN ${isEntry ? 'MASUK' : 'PULANG'} menggunakan fragmen: [${selectedHook}] [${selectedContext}] [${selectedPunchline}].`,
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
