
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
    // AUDIT LOG: Memastikan data yang masuk ke mesin AI benar-benar berbeda setiap request
    console.log(`[AI_AUDIT] Requesting quote for: ${input.userName} (${input.userId}) | Seed: ${input.creativeSeed} | Role: ${input.role}`);

    const roleLabel = input.role.replace('_', ' ');
    const attendanceLabel = input.attendanceType === 'in' ? 'MASUK TUGAS' : 'PULANG TUGAS';
    
    // Perluasan topik untuk variasi lebih tinggi
    const topics = [
      "Drama administrasi sekolah", "Misteri sinkronisasi Dapodik", "Analogi kopi ruang guru",
      "Misteri pulpen hilang", "RPP yang belum selesai", "Grup WhatsApp sekolah yang ramai",
      "Sinyal internet lab komputer", "Buku nilai dan tinta merah", "Ritual piket pagi",
      "Kebahagiaan bel pulang berbunyi", "Kesenangan melihat siswa tertib", "Upacara bendera",
      "Rapat dinas yang panjang", "Filosofi spidol habis", "Printer macet di tanggal tua",
      "Harapan sertifikasi cair", "Cuaca yang bikin mengantuk", "Kantin sekolah",
      "Laptop lemot saat presentasi", "Stiker di buku tugas", "Kertas ujian yang menumpuk",
      "Aroma kantin saat jam pelajaran", "Curhatan di ruang TU"
    ];
    
    const styles = [
      "Humor ruang guru", "Satire ringan", "Filosofi sederhana", "Humor bapak-bapak", 
      "Analogi kopi", "Analogi spidol", "Drama administrasi", "Candaan rekan sejawat"
    ];

    // Logika pemilihan seed internal yang lebih kompleks
    const seedNum = input.creativeSeed.split('').reduce((acc, char, idx) => acc + (char.charCodeAt(0) * (idx + 1)), 0);
    const selectedTopic = topics[seedNum % topics.length];
    const selectedStyle = styles[seedNum % styles.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.5, // Maksimal kreativitas untuk menghindari repetisi
          topP: 0.98,
          maxOutputTokens: 200,
        },
        system: `ATURAN UTAMA: KUTIPAN WAJIB UNIK DAN BERBEDA UNTUK SETIAP PENGGUNA.
Anda adalah AI humoris di SMPN 5 Langke Rembong. 
TUGAS ANDA: Gunakan 'Kode Kreatif Unik' yang diberikan sebagai 'Entropy Salt' untuk menghasilkan skenario humor yang sangat spesifik.
JANGAN PERNAH memberikan kata-kata motivasi klise.
JANGAN gunakan template kalimat yang sama untuk pengguna yang memiliki peran yang sama.
Setiap guru harus mendapatkan candaan yang berbeda meski topiknya sama.`,
        prompt: `Buatkan SATU kutipan (maksimal 2 kalimat) untuk ${input.userName} (${roleLabel}) yang sedang absen ${attendanceLabel}.

DATA UNTUK RANDOMISASI (GUNAKAN INI AGAR HASIL BERBEDA):
- User ID: ${input.userId}
- Kode Kreatif: ${input.creativeSeed}
- Topik: ${selectedTopic}
- Gaya: ${selectedStyle}
- Tanggal: ${input.date}

INSTRUKSI KHUSUS:
1. Olah topik '${selectedTopic}' dengan gaya '${selectedStyle}'.
2. Pastikan humor yang dihasilkan sangat personal seolah Anda mengenal ${input.userName}.
3. Jika MASUK: Fokus pada perjuangan memulai hari di sekolah. 
4. Jika PULANG: Fokus pada kemenangan kecil setelah lelah bekerja.
5. Bahasa Indonesia santai, natural, dilarang emoji, dilarang klise.

OUTPUT: JSON dengan field 'quote' dan 'author' (isi dengan "AI E-SPENLI").`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      
      // LOG HASIL: Untuk memantau keunikan di console server
      console.log(`[AI_AUDIT] Quote Generated: "${response.output.quote.substring(0, 30)}..."`);
      
      return response.output;
    } catch (err: any) {
      console.error('[AI_AUDIT_ERROR]:', err.message);
      throw err;
    }
  }
);
