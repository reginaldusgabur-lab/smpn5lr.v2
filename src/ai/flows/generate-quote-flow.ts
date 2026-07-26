'use server';
/**
 * @fileOverview AI Flow untuk menghasilkan kutipan motivasi dengan karakter sekolah SMP.
 * Dioptimalkan untuk variasi tinggi, humor profesi, dan relevansi peran.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const QuoteInputSchema = z.object({
  category: z.string().describe('Peran pengguna (admin, kepala_sekolah, guru, pegawai, siswa)'),
  attendanceType: z.enum(['in', 'out']).describe('Tipe absensi'),
  seed: z.number().optional().describe('Nilai acak untuk memicu kreativitas unik'),
});

const QuoteOutputSchema = z.object({
  quote: z.string().describe('Isi kutipan humoris/motivasi'),
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
    const jenisAbsen = input.attendanceType === 'in' ? 'masuk tugas' : 'pulang tugas';
    const peran = (input.category || 'Guru').replace('_', ' ');
    
    // Daftar topik mikro untuk variasi prompt yang cerdas dan relatable
    const topics = [
      "Drama sinkronisasi Dapodik yang tidak kunjung biru",
      "Misteri pulpen di meja kantor yang sering pindah alam",
      "Ritual kopi atau teh kental sebelum menghadapi kelas",
      "Tumpukan RPP dan administrasi yang lebih tinggi dari harapan",
      "Momen lucu saat siswa salah panggil nama guru",
      "Perasaan lega saat bel pulang berbunyi tepat waktu",
      "Grup WhatsApp sekolah yang notifikasinya tak pernah tidur",
      "Sinyal internet sekolah yang kadang ada kadang malu-malu",
      "Semangat mencerdaskan bangsa di tengah cuaca yang bikin ngantuk",
      "Interaksi random dengan rekan sejawat di ruang guru",
      "Harapan untuk hari esok yang lebih cerah dan tanpa revisi",
      "Kesenangan sederhana saat semua siswa memperhatikan pelajaran",
      "Drama jam kosong yang penuh dengan negosiasi",
      "Pentingnya kesabaran setebal kamus bahasa Inggris",
      "Momen 'Aha!' saat siswa akhirnya mengerti rumus sulit",
      "Harapan agar gajian atau sertifikasi cair sebelum tanggal tua",
      "Kebahagiaan melihat laci meja rapi setelah seharian kerja",
      "Filosofi spidol habis di saat-saat genting",
      "Pentingnya senyum meskipun data inventaris belum sinkron",
      "Semangat pejuang pendidikan di SMPN 5 Langke Rembong",
      "Piket pagi yang penuh dengan sambutan hangat",
      "Rebutan colokan listrik di ruang guru",
      "Upacara bendera yang melatih ketahanan kaki dan kesabaran",
      "Rapat dinas yang durasinya seringkali 'fleksibel'",
      "Koleksi tumbler di atas meja yang mulai menyerupai toko pecah belah"
    ];
    
    // Memilih topik berdasarkan seed untuk menjamin variasi lintas pengguna dan sesi
    const selectedTopic = topics[(input.seed || 0) % topics.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: `Saya adalah seorang ${peran} di SMPN 5 Langke Rembong. 
Buatkan saya kutipan singkat yang lucu, humoris, dan menghibur untuk menyemangati hari saya saat sedang melakukan absensi ${jenisAbsen}.

KONTEKS KHUSUS:
- Topik spesifik hari ini: ${selectedTopic}
- Gaya bahasa: Santai, natural (seperti ngobrol di ruang guru), humoris, dan tidak kaku.
- JANGAN gunakan kata motivasi klise seperti "Masa depan di tanganmu". Gunakan sindiran lucu yang cerdas tentang kerepotan profesi.

OUTPUT:
Hasilkan 1-2 kalimat pendek saja dalam format JSON dengan field 'quote' (isi kutipan) dan 'author' (isi dengan "AI E-SPENLI").`,
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
