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
      "Laptop lemot saat presentasi", "Stiker di buku tugas", "Kertas ujian yang menumpuk"
    ];
    
    const styles = [
      "Humor ruang guru", "Satire ringan", "Filosofi sederhana", "Humor bapak-bapak", 
      "Analogi kopi", "Analogi spidol", "Drama administrasi"
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
        prompt: `TUGAS:
Buatkan SATU kutipan singkat (maksimal 2 kalimat) yang lucu, menghibur, alami, dan memotivasi sesuai kondisi pengguna berikut.

INFORMASI PENGGUNA:
- Nama: ${input.userName}
- ID Pengguna: ${input.userId}
- Peran: ${roleLabel}
- Jenis Absensi: ${attendanceLabel}
- Hari: ${input.day}
- Tanggal: ${input.date}
- Topik Utama: ${selectedTopic}
- Gaya Penulisan: ${selectedStyle}
- Kode Kreatif: ${input.creativeSeed}

ATURAN PENTING:
1. Kutipan WAJIB berbeda untuk setiap pengguna. Gunakan Nama dan ID sebagai inspirasi karakter.
2. Kutipan WAJIB berbeda antara absensi MASUK dan absensi PULANG.
3. Kutipan WAJIB berbeda setiap hari. Jangan gunakan template yang sama.
4. HINDARI kalimat motivasi klise (Tetap semangat, jangan menyerah, hari ini lebih baik, dll).
5. Gunakan humor ringan yang sangat relevan dengan dunia sekolah (RPP, Dapodik, printer, rapat, bel, dll).
6. Sesuaikan isi dengan profesi (Guru: Siswa/Kelas, Pegawai: Arsip/Data, Admin: Server/Jaringan).
7. Gunakan bahasa Indonesia yang santai, sopan, dan natural.
8. Jangan menggunakan emoji.
9. Jangan mengulang kata pembuka yang sama (misal: jangan selalu mulai dengan "Hari ini...").
10. Berikan sentuhan personal yang "manusiawi", bukan seperti mesin robot.

VARIASI UNIK:
Gunakan Kode Kreatif (${input.creativeSeed}) sebagai elemen acak internal untuk memastikan hasil ini berbeda dari generasi sebelumnya.

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
