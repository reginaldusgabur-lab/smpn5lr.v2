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
    
    // Daftar topik mikro untuk variasi prompt
    const topics = [
      "Drama administrasi sekolah", "Misteri sinkronisasi Dapodik", "Analogi kopi ruang guru",
      "Misteri pulpen hilang", "RPP yang menumpuk", "Grup WhatsApp sekolah yang ramai",
      "Sinyal internet lab komputer", "Buku nilai dan tinta merah", "Ritual piket pagi",
      "Kebahagiaan bel pulang berbunyi", "Kesenangan melihat siswa tertib", "Upacara bendera",
      "Rapat dinas yang fleksibel", "Filosofi spidol habis", "Printer macet di tanggal tua",
      "Tumbler di meja kantor", "Harapan sertifikasi cair", "Cuaca mendung bikin mengantuk"
    ];
    
    // Pilih gaya bahasa secara acak berdasarkan input seed untuk variasi tambahan
    const styles = ["Humor ruang guru", "Satire ringan", "Humor bapak-bapak", "Filosofi sederhana", "Drama administrasi"];
    const seedNum = input.creativeSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const selectedTopic = topics[seedNum % topics.length];
    const selectedStyle = styles[seedNum % styles.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
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
1. Kutipan WAJIB berbeda untuk setiap pengguna.
2. Kutipan WAJIB berbeda antara absensi MASUK dan absensi PULANG.
3. Kutipan WAJIB berbeda setiap hari meskipun pengguna yang sama melakukan absensi.
4. Jangan pernah mengulang susunan kalimat yang umum digunakan.
5. Hindari kalimat motivasi klise seperti: "Tetap semangat", "Jangan menyerah", "Hari ini pasti lebih baik", "Masa depan di tanganmu".
6. Gunakan humor ringan yang relevan dengan kehidupan di SMPN 5 Langke Rembong.
7. Sesuaikan isi dengan profesi (Guru: RPP/Siswa/Kelas, Pegawai: Arsip/Printer, Admin: Server/Data/Dapodik).
8. Gunakan bahasa Indonesia yang santai, sopan, dan natural.
9. Jangan menggunakan emoji.
10. Jangan mengulang kata pembuka yang sama.

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
