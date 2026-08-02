
'use server';
/**
 * @fileOverview AI Flow yang dioptimalkan untuk menghasilkan kutipan unik tinggi.
 * Audit Fix: Memastikan AI tidak hanya terpaku pada peran (Role) melainkan pada seed unik pengguna.
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
    console.log(`[AI_AUDIT] Generating unique quote for UID: ${input.userId} | Seed: ${input.creativeSeed}`);

    const roleLabel = input.role.replace('_', ' ');
    const attendanceLabel = input.attendanceType === 'in' ? 'MASUK TUGAS' : 'PULANG TUGAS';
    
    // Audit Perbaikan: Perluasan masif topik & gaya untuk menghindari tabrakan modulo
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

    // Logika pemilihan seed internal yang lebih kompleks (Multi-pass hashing)
    const seedNum = input.creativeSeed.split('').reduce((acc, char, idx) => acc + (char.charCodeAt(0) * (idx + 1)), 0);
    const selectedTopic = topics[seedNum % topics.length];
    const selectedStyle = styles[(seedNum * 7) % styles.length]; // Pengali untuk variasi gaya berbeda

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.5, // Maksimal kreativitas
          topP: 0.98,
          maxOutputTokens: 250,
        },
        system: `ATURAN MUTLAK: SETIAP KUTIPAN WAJIB UNIK, BERBEDA, DAN TIDAK BOLEH REPETITIF.
Gunakan data identitas berikut sebagai 'DNA' untuk menghasilkan skenario humor yang sangat spesifik dan personal. 

INSTRUKSI TEKNIS:
1. Gunakan 'Kode Kreatif' sebagai inspirasi kunci untuk membedakan satu pengguna dengan pengguna lain.
2. JANGAN PERNAH memberikan kata-kata motivasi klise (seperti 'tetap semangat', 'jangan menyerah').
3. Setiap Guru atau Pegawai harus mendapatkan cerita/candaan yang berbeda meskipun mereka dalam satu ruangan yang sama.
4. Bahasa Indonesia santai (natural), sopan, tanpa emoji, dan maksimal 2 kalimat.`,
        prompt: `Buatkan SATU kutipan unik untuk ${input.userName} (${roleLabel}) yang sedang absen ${attendanceLabel}.

DATA SCENARIO (WAJIB DIGUNAKAN UNTUK VARIASI):
- User ID: ${input.userId}
- Kode Kreatif: ${input.creativeSeed}
- Topik Utama: ${selectedTopic}
- Gaya Penulisan: ${selectedStyle}
- Tanggal & Hari: ${input.day}, ${input.date}

Pastikan humor sangat personal seolah Anda adalah rekan sejawat di SMPN 5 Langke Rembong yang mengenal situasi harian mereka.`,
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
