
'use server';
/**
 * @fileOverview AI Flow yang dioptimalkan untuk menghasilkan kutipan unik tinggi.
 * Menggunakan parameter personal pengguna untuk mencegah pengulangan.
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
    const roleLabel = input.role.replace('_', ' ');
    const attendanceLabel = input.attendanceType === 'in' ? 'MASUK TUGAS' : 'PULANG TUGAS';
    
    // Daftar topik mikro yang jauh lebih luas untuk variasi maksimal
    const topics = [
      "Drama administrasi sekolah", "Misteri sinkronisasi Dapodik", "Analogi kopi ruang guru",
      "Misteri pulpen hilang", "RPP yang belum selesai", "Grup WhatsApp sekolah yang ramai",
      "Sinyal internet lab komputer", "Buku nilai dan tinta merah", "Ritual piket pagi",
      "Kebahagiaan bel pulang berbunyi", "Kesenangan melihat siswa tertib", "Upacara bendera",
      "Rapat dinas yang panjang", "Filosofi spidol habis", "Printer macet di tanggal tua",
      "Tumbler di meja kantor", "Harapan sertifikasi cair", "Cuaca yang bikin mengantuk",
      "Pengecekan absensi manual", "Kantin sekolah", "Kunci ruang kelas yang tertukar",
      "Laptop lemot saat presentasi", "Stiker di buku tugas", "Kertas ujian yang menumpuk",
      "Misteri penghapus papan tulis", "Aroma kantin saat jam pelajaran", "Curhatan di ruang TU"
    ];
    
    const styles = [
      "Humor ruang guru", "Satire ringan", "Filosofi sederhana", "Humor bapak-bapak", 
      "Analogi kopi", "Analogi spidol", "Drama administrasi", "Candaan rekan sejawat"
    ];

    // Logika pemilihan index yang lebih acak namun tetap terikat pada seed harian
    const seedNum = input.creativeSeed.split('').reduce((acc, char, idx) => acc + (char.charCodeAt(0) * (idx + 1)), 0);
    const selectedTopic = topics[seedNum % topics.length];
    const selectedStyle = styles[seedNum % styles.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.2, // Menaikkan kreativitas untuk menghindari pengulangan
          topP: 0.95,
          maxOutputTokens: 150,
        },
        system: `Anda adalah AI humoris yang bertugas menghibur guru dan staf di SMPN 5 Langke Rembong.
Kutipan Anda harus cerdas, singkat, dan sangat relevan dengan peran mereka. 
JANGAN PERNAH memberikan kata-kata motivasi klise seperti "Tetap semangat" atau "Hari ini lebih baik". 
Gunakan satire ringan, humor ruang guru, atau candaan birokrasi sekolah yang cerdas.`,
        prompt: `TUGAS:
Saya adalah seorang ${roleLabel} bernama ${input.userName}. Tolong buatkan SATU kutipan singkat (maksimal 2 kalimat) yang lucu, humoris, alami, dan sedikit memotivasi sesuai kondisi saya saat ini.

INFORMASI PENGGUNA:
- Nama: ${input.userName}
- ID Pengguna: ${input.userId}
- Peran: ${roleLabel}
- Jenis Absensi: ${attendanceLabel}
- Hari: ${input.day}
- Tanggal: ${input.date}
- Topik Utama: ${selectedTopic}
- Gaya Penulisan: ${selectedStyle}
- Kode Kreatif Unik: ${input.creativeSeed}

ATURAN KETAT:
1. Kutipan WAJIB unik dan berbeda secara drastis setiap kali dipanggil. Gunakan ID Pengguna (${input.userId}) dan Kode Kreatif (${input.creativeSeed}) sebagai elemen acak internal Anda.
2. JANGAN PERNAH gunakan template atau kalimat yang sama dengan sesi sebelumnya.
3. HINDARI kalimat motivasi kaku yang membosankan.
4. Gunakan humor yang hanya dipahami orang sekolah (masalah printer, RPP, Dapodik, rapat, atau bel sekolah).
5. Jika MASUK: Fokus pada "perjuangan" memulai hari. Jika PULANG: Fokus pada "kemenangan" menyelesaikan hari.
6. Bahasa Indonesia santai, sopan, dan natural. Jangan gunakan emoji.

OUTPUT:
Kembalikan JSON saja dengan field 'quote' dan 'author' (isi dengan "AI E-SPENLI").`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('GENKIT_RUNTIME_ERROR:', err.message);
      throw err;
    }
  }
);
