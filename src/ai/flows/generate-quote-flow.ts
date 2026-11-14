'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan humor dari internet dan realita sekolah.
 * Mendukung penggunaan Kunci API dinamis dari database (Prioritas 1) atau Vercel (Prioritas 2).
 * Sistem cadangan menggunakan rotasi berurutan berbasis tanggal untuk mencegah duplikasi mingguan.
 */

import { ai } from '../genkit';
import { z, genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { adminDb } from '@/lib/firebase-admin';

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
  isAi: z.boolean().optional(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

/**
 * Database Kutipan Cadangan Humor (Kombinasi Humor Sekolah, Kopi, & Motivasi Santai)
 */
const fallbacks = [
  { quote: "Guru itu pahlawan tanpa tanda jasa, tapi tetap butuh tanda transferan di akhir bulan.", author: "Fakta Bendahara" },
  { quote: "Ruang guru: Tempat di mana semua masalah dunia selesai dalam 15 menit jam istirahat.", author: "Realita Sekolah" },
  { quote: "Kopi guru: 70% kafein, 30% doa agar murid hari ini tidak terlalu ajaib.", author: "Ramuan Rahasia" },
  { quote: "Tugas saya bukan untuk berhasil, tapi untuk mencoba... mencoba sabar menghadapi murid.", author: "Pakar Kesabaran" },
  { quote: "Senyum adalah ibadah. Tapi senyum sendiri di depan laptop itu tanda butuh libur.", author: "Psikologi Staf" },
  { quote: "Pekerjaan paling berat adalah terlihat sibuk ketika Kepala Sekolah lewat.", author: "Seni Kerja" },
  { quote: "Laptop lemot adalah ujian kesabaran yang lebih berat daripada nunggu antrean sembako.", author: "Teknologi Sekolah" },
  { quote: "Jika murid bertanya hal sulit, jawablah: 'Itu PR untuk minggu depan'.", author: "Ilmu Pertahanan Diri" },
  { quote: "Bahagia itu sederhana: Lihat pengumuman libur mendadak di grup WhatsApp sekolah.", author: "Definisi Bahagia" },
  { quote: "Cintailah pekerjaanmu, tapi jangan menikahi pekerjaanmu. Nanti lupa punya rumah.", author: "Work-Life Balance" },
  { quote: "Motivasi hari ini: Absen masuk, kerjakan tugas, lalu pulang ke pelukan kasur dengan tenang.", author: "Target Harian" },
  { quote: "Hargailah waktu, karena waktu tidak bisa diputar balik, kecuali jam dinding kelas yang mati.", author: "Logika Waktu" },
  { quote: "Masa depan cerah dimulai dari absen pagi yang tepat waktu (sebelum sistem merah).", author: "Visi E-SPENLI" },
  { quote: "Orang pintar minum tolak angin, orang sabar jadi guru SMP.", author: "Pepatah Modifikasi" },
  { quote: "Dibalik guru yang hebat, ada asupan gorengan kantin yang sangat nikmat.", author: "Kuliner Sekolah" },
  { quote: "Seberat-beratnya rindu, lebih berat lagi rindu libur panjang semesteran.", author: "Dilan Sekolah" },
  { quote: "Uang bukan segalanya, tapi kalau tidak ada uang, bayar kuota absen pakai apa?", author: "Tanya Jawab Ekonomi" },
  { quote: "Jangan menyerah pada mimpimu, teruslah tidur sampai mimpimu jadi nyata.", author: "Saran Sesat" },
  { quote: "Kesuksesan itu 1% niat, 99% berusaha tidak mengantuk saat rapat.", author: "Rumus Sukses" },
  { quote: "Jadilah pribadi yang berkarakter, tapi jangan jadi karakter video game yang cepat mati.", author: "Gamer Bijak" },
  { quote: "Berakit-rakit ke hulu, berenang-renang ke tepian. Absen masuk dahulu, gajian kemudian.", author: "Pantun Digital" },
  { quote: "Jangan marah kalau dikritik pimpinan, marah itu kalau gaji dipotong sistem.", author: "Prioritas Marah" },
  { quote: "Pekerjaan paling menyenangkan adalah hobi yang dibayar, tapi guru itu panggilan jiwa yang dibayar.", author: "Filosofi Kerja" },
  { quote: "Masa depan itu misteri, tapi kalau tidak absen masuk hari ini, masa depan jadi suram.", author: "Ramalan Absen" },
  { quote: "Kesuksesan berawal dari mimpi, jadi mari kita tidur sebentar lagi di ruang guru.", author: "Humor Rebahan" },
  { quote: "Hidup itu indah jika kita tahu cara menikmatinya, bukan cara mengeluhkannya di status WA.", author: "Pakar Syukur" },
  { quote: "Pendidikan memang mahal, tapi lebih mahal lagi kalau tidak punya ijazah.", author: "Logika Dasar" },
  { quote: "Kesabaran guru setipis tisu, tapi kalau digabung bisa jadi buku tebal.", author: "Analogi Tisu" },
  { quote: "Jangan takut bermimpi besar, takutlah kalau bangun tidur sudah jam 8 pagi.", author: "Alarm Sekolah" },
  { quote: "Guru yang baik adalah yang tidak pernah lupa membawa kunci jawaban.", author: "Rahasia Sukses" },
  { quote: "Hidup itu singkat. Singkat kalau libur, panjang kalau lagi nunggu jam pulang.", author: "Relativitas Waktu" },
  { quote: "Kerja cerdas itu penting, tapi jangan terlalu cerdas nanti dikasih tugas tambahan.", author: "Strategi Staf" },
  { quote: "Hidup itu seperti roda, kadang di atas, kadang di bawah, kadang harus didorong karena mogok.", author: "Mekanik Kehidupan" },
  { quote: "Jangan sia-siakan waktumu, karena waktu tidak bisa dibeli dengan koin Shopee.", author: "Tips Belanja" },
  { quote: "Sukses itu butuh proses, kalau butuh yang instan ya makan mi saja di kantin.", author: "Kuliner Motivasi" },
  { quote: "Jadilah terang di kegelapan, tapi jangan jadi lampu pijar yang gampang putus.", author: "Pesan Cahaya" },
  { quote: "Hargailah gaji yang lewat, karena dia cuma mampir sebentar lalu pergi lagi tanpa pamit.", author: "Sajak Bendahara" },
  { quote: "Masa depan bangsa ada di tangan guru, jadi pastikan tanganmu tidak gemetar pas gajian.", author: "Pesan Kebangsaan" },
  { quote: "Pekerjaan berat akan terasa ringan jika kita tidak mengerjakannya sama sekali.", author: "Sesat Pikir" },
  { quote: "Jangan biarkan masa lalumu menghambat masa depanmu, kecuali kalau kamu belum bayar hutang kantin.", author: "Logika Tagihan" }
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
    // LOGIKA SEQUENTIAL (Berurutan): Menggunakan jumlah hari sejak Epoch (1970)
    // tujuannya agar setiap hari memiliki kutipan berbeda dan tidak berulang dalam seminggu
    const now = new Date();
    const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    
    // Indeks stabil per hari. Jika ingin per user berbeda namun tetap berurutan per hari, 
    // kita bisa menambahkan hash userId, tapi permintaan user adalah rotasi stabil.
    const stableIndex = daysSinceEpoch % fallbacks.length;
    const selectedFallback = { ...fallbacks[stableIndex], isAi: false };

    try {
        const configSnap = await adminDb.collection('schoolConfig').doc('default').get();
        const configData = configSnap.data();
        const customApiKey = configData?.geminiApiKey?.trim();
        const effectiveApiKey = customApiKey || process.env.GEMINI_API_KEY;

        if (!effectiveApiKey) return selectedFallback;

        const dynamicAi = genkit({
            plugins: [googleAI({ apiKey: effectiveApiKey })],
        });

        const response = await dynamicAi.generate({
            model: 'googleai/gemini-1.5-flash',
            config: { temperature: 1.3, topP: 0.95, maxOutputTokens: 250 },
            system: `Anda adalah "E-SPENLI Muse", komedian cerdas bagi warga SMPN 5 Langke Rembong. TUGAS: Berikan SATU kutipan pendek (15-20 kata) yang SANGAT LUCU, relevan dengan guru/staf. Gunakan gaya bahasa Indonesia santai, humor receh tapi sopan. WAJIB sertakan nama penulisnya.`,
            prompt: `Buat kutipan humor untuk ${input.userName} (${input.role}) pada sesi ${input.attendanceType === 'in' ? 'absen masuk pagi' : 'absen pulang sore'}. Benih acak: ${input.creativeSeed}`,
            output: { schema: z.object({ quote: z.string(), author: z.string() }) },
        });

        if (!response.output || !response.output.quote) throw new Error('EMPTY');
        return { quote: response.output.quote, author: response.output.author, isAi: true };
    } catch (err) {
        // Jika AI gagal, gunakan kutipan berurutan dari database cadangan
        return selectedFallback;
    }
  }
);
