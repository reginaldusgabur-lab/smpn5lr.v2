'use server';
/**
 * @fileOverview AI Flow Deterministik dengan Jutaan Kombinasi.
 * Variasi dipaksa melalui hashing multi-dimensi untuk menjamin keunikan per user/hari/sesi.
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
 * Robust 32-bit hashing function.
 */
function getHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
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
    // 60 TOPICS (Spesifik & Unik)
    const topics = [
      "Sinyal Wi-Fi lab yang timbul tenggelam", "Misteri pulpen pilot yang sering hilang", "Aroma nasi kuning di pagi hari",
      "Rapat dinas yang bisa jadi e-mail", "Drama printer macet saat jam pertama", "Ritual koreksi soal pilihan ganda",
      "Analogi kopi hitam tanpa gula", "Filosofi kapur tulis vs spidol whiteboard", "Misteri kursi plastik retak",
      "Proyektor menyala sekali klik", "Laptop lawas yang lemot saat presentasi", "Grup WhatsApp sekolah penuh stiker",
      "Bel sekolah yang bunyinya kepanjangan", "Curhatan di ruang tata usaha", "Bau buku paket baru",
      "Dilema menu kantin hari ini", "Misteri penghapus papan tulis", "Sinkronisasi Dapodik tengah malam",
      "Harapan sertifikasi cair", "Analogi spidol tinta pudar", "Misteri air galon habis",
      "Upacara bendera di bawah mendung", "Piket pagi berujung sarapan", "Lomba kebersihan antar kelas",
      "RPP yang masih tersimpan di draft", "Tanda tangan manual di buku absen", "Kertas ujian menumpuk",
      "Laptop tiba-tiba update Windows", "Antrean fotokopi soal", "Kunci lemari arsip terselip",
      "Sinyal HP hilang di kelas pojok", "Cerita horor ringan gudang olahraga", "Tinta merah di buku nilai",
      "Siswa lupa bawa PR", "Filosofi seragam batik Kamis", "Hujan bikin suasana melow",
      "Cuaca panas bikin ngantuk", "Ritual minum teh ruang guru", "Keramaian kantin istirahat kedua",
      "Laporan bulanan selesai tepat waktu", "Kabel proyektor hilang", "Penghapus yang sudah gundul",
      "Filosofi sapu lidi pojok kelas", "Salah kostum seragam Senin", "Jam kosong mendadak",
      "Sepatu siswa di depan kelas", "Harapan libur panjang", "Penggaris kayu legendaris",
      "Rapat komite sekolah", "Spidol habis pas nerangkan", "Siswa bisa ngerjakan soal susah",
      "Kotak saran penuh debu", "Lemari besi susah dibuka", "Aroma ruangan baru dipel",
      "Speaker kelas kresek-kresek", "Baterai laptop drop", "Pengumuman libur dadakan",
      "Meja guru penuh tumpukan buku", "Kuota internet habis pas zoom", "Misteri stapler yang dipinjam"
    ];
    
    // 25 STYLES
    const styles = [
      "Humor ruang guru", "Satire ringan", "Filosofi bapak-bapak", "Gaya Millennial", 
      "Analogi kopi", "Analogi teknis", "Drama administrasi", "Candaan sejawat",
      "Nasihat bijak santai", "Observasi unik", "Humor teknis", "Puisi receh",
      "Sarkasme halus", "Gaya detektif", "Review produk", "Berita singkat",
      "Curhatan batin", "Metafora sekolah", "Gaya koki", "Ramalan cuaca",
      "Gaya motivasi terbalik", "Dialog imajiner", "Iklan radio", "Dongeng singkat", "Komedi situasi"
    ];

    // 20 FORMATS (Strict Constraints)
    const formats = [
      { name: "Dialog Singkat", rule: "Tulis dalam 2 baris dialog antara dua orang." },
      { name: "Observasi + Punchline", rule: "Baris 1: Fakta/Observasi. Baris 2: Kesimpulan lucu." },
      { name: "Analogi Unik", rule: "Bandingkan topik sekolah dengan benda sehari-hari." },
      { name: "Pantun Kilat", rule: "Tulis dalam bentuk pantun 2 baris (rima a-a)." },
      { name: "Satu Kalimat Filosofis", rule: "Satu kalimat pendek tapi sangat dalam/lucu." },
      { name: "Memo Singkat", rule: "Tulis seperti instruksi memo kantor yang lucu." },
      { name: "Berita Utama", rule: "Tulis seperti headline berita heboh internal sekolah." },
      { name: "Perbandingan (Dulu vs Sekarang)", rule: "Tulis perbedaan situasi sekolah dulu dan sekarang." },
      { name: "Pesan Error Teknis", rule: "Tulis seperti pesan error komputer tapi untuk masalah sekolah." },
      { name: "Dialog Batin", rule: "Tulis apa yang dipikirkan tapi tidak diucapkan." },
      { name: "Tips Absurd", rule: "Berikan satu tips tidak berguna tapi lucu terkait sekolah." },
      { name: "Definisi Kamus", rule: "Tulis definisi topik tersebut seperti di kamus lucu." },
      { name: "Tanya Jawab", rule: "Tulis satu pertanyaan pendek dan jawaban yang tidak nyambung." },
      { name: "Alasan Klasik", rule: "Tulis satu alasan lucu kenapa hal itu terjadi." },
      { name: "Zodiak Sekolah", rule: "Tulis prediksi nasib berdasarkan peran dan topik." },
      { name: "Review Bintang 1", rule: "Tulis review lucu seolah-olah topik itu adalah produk buruk." },
      { name: "Status Media Sosial", rule: "Tulis seperti status galau atau sombong di medsos." },
      { name: "Aturan Tak Tertulis", rule: "Tulis satu hukum alam yang hanya ada di sekolah ini." },
      { name: "Memo Kepala Sekolah", rule: "Tulis instruksi tegas tapi isinya receh." },
      { name: "Bisikan Tetangga", rule: "Tulis seperti gosip ringan di sela-sela jam istirahat." }
    ];

    // 10 PERSPECTIVES
    const perspectives = [
      "Orang pertama (Aku/Saya)", "Orang ketiga (Dia/Mereka)", "Sudut pandang cangkir kopi",
      "Sudut pandang spidol habis", "Pengamat rahasia", "Sejarawan sekolah",
      "Pakar Dapodik", "Siswa paling belakang", "Penjaga kantin", "Admin server"
    ];

    // MULTI-DIMENSIONAL DETERMINISTIC HASHING
    const fullSeed = `${input.userId}|${input.date}|${input.day}|${input.attendanceType}|${input.creativeSeed}`;
    const baseHash = getHash(fullSeed);
    
    const selectedTopic = topics[baseHash % topics.length];
    const selectedStyle = styles[(baseHash >> 2) % styles.length];
    const selectedFormat = formats[(baseHash >> 4) % formats.length];
    const selectedPersp = perspectives[(baseHash >> 6) % perspectives.length];

    // LOGGING AUDIT UNTUK VERIFIKASI KEUNIKAN
    console.log(`[AI_AUDIT] User: ${input.userName} | Hash: ${baseHash} | Role: ${input.role}`);
    console.log(`[AI_AUDIT] Selection -> Topic: ${selectedTopic} | Style: ${selectedStyle} | Format: ${selectedFormat.name} | Persp: ${selectedPersp}`);

    const roleLabel = input.role.replace('_', ' ');
    const attendanceLabel = input.attendanceType === 'in' ? 'MULAI TUGAS' : 'SELESAI TUGAS';

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.3,
          topP: 0.95,
          maxOutputTokens: 250,
        },
        system: `Anda adalah Asisten Humor Deterministik di SMPN 5 Langke Rembong.
TUGAS: Mengubah parameter input menjadi kutipan lucu yang alami.

ATURAN STRUKTUR (WAJIB):
1. Format Pesan: ${selectedFormat.name}
2. Aturan Format: ${selectedFormat.rule}
3. Perspektif: ${selectedPersp}
4. Gaya: ${selectedStyle}
5. Topik: ${selectedTopic}

LARANGAN KERAS:
- JANGAN gunakan kata: "Semangat", "Menyerah", "Kunci", "Sukses", "Masa Depan".
- JANGAN awali dengan sapaan formal atau "Kutipan hari ini adalah".
- JANGAN gunakan emoji.
- JANGAN mengulang pola kalimat format lain.`,
        prompt: `Buatkan pesan untuk ${input.userName} (${roleLabel}) saat ${attendanceLabel}. 
        Gunakan kombinasi unik: Topik "${selectedTopic}" dengan Gaya "${selectedStyle}" dalam format "${selectedFormat.name}".
        Pesan harus maksimal 2 kalimat pendek dan terasa sangat personal untuk personil tersebut.`,
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
