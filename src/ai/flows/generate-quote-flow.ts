
'use server';
/**
 * @fileOverview AI Flow yang dioptimalkan dengan arsitektur deterministik.
 * Variasi ditentukan oleh aplikasi melalui hashing UID, AI bertugas menyusun kalimat.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const QuoteInputSchema = z.object({
  userName: z.string().describe('Nama pengguna'),
  userId: z.string().describe('UID unik pengguna'),
  role: z.string().describe('Peran (admin, kepala_sekolah, guru, pegawai, siswa)'),
  attendanceType: z.enum(['in', 'out']).describe('Tipe absensi'),
  day: z.string().describe('Hari saat ini'),
  date: z.string().describe('Tanggal dalam format YYYY-MM-DD'),
  creativeSeed: z.string().describe('Kombinasi unik untuk memicu variasi AI'),
});

const QuoteOutputSchema = z.object({
  quote: z.string().describe('Isi kutipan'),
  author: z.string().describe('Penulis (Selalu AI E-SPENLI)'),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

/**
 * Robust 32-bit hashing function untuk memastikan penyebaran seed yang luas.
 */
function getHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
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
    const topics = [
      "Drama administrasi sekolah", "Misteri sinkronisasi Dapodik", "Analogi kopi ruang guru",
      "Misteri pulpen hilang", "RPP yang belum selesai", "Grup WhatsApp sekolah yang ramai",
      "Sinyal internet lab komputer", "Buku nilai dan tinta merah", "Ritual piket pagi",
      "Kebahagiaan bel pulang berbunyi", "Kesenangan melihat siswa tertib", "Upacara bendera",
      "Rapat dinas yang panjang", "Filosofi spidol habis", "Printer macet di tanggal tua",
      "Harapan sertifikasi cair", "Cuaca yang bikin mengantuk", "Kantin sekolah",
      "Laptop lemot saat presentasi", "Stiker di buku tugas", "Kertas ujian yang menumpuk",
      "Aroma kantin saat jam pelajaran", "Curhatan di ruang TU", "Siswa lupa bawa buku",
      "Tugas menumpuk di meja", "Sinyal Wi-Fi yang timbul tenggelam", "Misteri penghapus papan tulis",
      "Ujian kejujuran saat koreksi", "Filosofi seragam rapi", "Semangat di gerbang sekolah",
      "Antrean di mesin fotokopi", "Keajaiban proyektor menyala sekali klik", "Harum kapur tulis",
      "Misteri kursi yang bergeser", "Ritual tanda tangan absen manual", "Dinamika rapat komite"
    ];
    
    const styles = [
      "Humor ruang guru", "Satire ringan", "Filosofi sederhana", "Humor bapak-bapak", 
      "Analogi kopi", "Analogi spidol", "Drama administrasi", "Candaan rekan sejawat",
      "Nasihat bijak tapi santai", "Observasi unik sekolah", "Humor teknis", "Puisi pendek lucu"
    ];

    const formats = [
      "Dialog singkat", "Analogi unik", "Pantun kilat", "Satu kalimat filosofis",
      "Observasi sarkastik", "Berita utama internal", "Curhatan batin", "Memo singkat lucu"
    ];

    // DETERMINISTIC SELECTION BERDASARKAN HASH UID + SEED
    const baseHash = getHash(input.creativeSeed);
    const selectedTopic = topics[baseHash % topics.length];
    const selectedStyle = styles[(baseHash >> 2) % styles.length];
    const selectedFormat = formats[(baseHash >> 4) % formats.length];

    // LOGGING AUDIT UNTUK VERIFIKASI IDENTITAS REQUEST
    console.log(`[AI_AUDIT] User: ${input.userName} | UID: ${input.userId}`);
    console.log(`[AI_AUDIT] Seed: ${input.creativeSeed}`);
    console.log(`[AI_AUDIT] Deterministic Selection -> Topic: ${selectedTopic} | Style: ${selectedStyle} | Format: ${selectedFormat}`);

    const roleLabel = input.role.replace('_', ' ');
    const attendanceLabel = input.attendanceType === 'in' ? 'MASUK TUGAS' : 'PULANG TUGAS';

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.3, // Kreativitas tinggi untuk narasi
          topP: 0.9,
          maxOutputTokens: 200,
        },
        system: `Anda adalah asisten humoris di SMPN 5 Langke Rembong. 
TUGAS MUTLAK: Tulis kutipan berdasarkan instruksi spesifik yang diberikan.
JANGAN gunakan kata-kata motivasi klise (semangat, pantang menyerah, dll).
Gunakan Bahasa Indonesia santai dan natural layaknya rekan kerja di sekolah.`,
        prompt: `Buatkan kutipan untuk ${input.userName} (${roleLabel}) saat ${attendanceLabel}.
        
INSTRUKSI STRUKTUR (WAJIB DIIKUTI):
1. Topik Utama: ${selectedTopic}
2. Gaya Penulisan: ${selectedStyle}
3. Format Pesan: ${selectedFormat}
4. Panjang: Maksimal 2 kalimat pendek.

Pastikan isi pesan benar-benar mencerminkan kombinasi Topik, Gaya, dan Format di atas secara spesifik agar tidak ada dua orang yang menerima pesan serupa.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      
      console.log(`[AI_AUDIT] Generated Quote for ${input.userId}: "${response.output.quote}"`);
      return response.output;
    } catch (err: any) {
      console.error('[AI_FLOW_ERROR]:', err.message);
      throw err;
    }
  }
);
