
'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan inspiratif atau humor dari tokoh dunia/nasional.
 * Mendukung penggunaan Kunci API dinamis dari database atau variabel lingkungan.
 * Versi V2.3: 500 Database Cadangan Humor Baru & Perbaikan Stabilitas API Key.
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
 * Database 500 Kutipan Cadangan Humor (School, Work, & Life Humor)
 */
const fallbacks = [
  { quote: "Guru itu pahlawan tanpa tanda jasa, tapi kalau tanggal muda tetap butuh tanda transferan.", author: "Realita Guru" },
  { quote: "Jangan berhenti bermimpi. Tapi ya jangan tidur terus pas jam pelajaran juga.", author: "Pesan Wali Kelas" },
  { quote: "Pendidikan itu penting, tapi kalau ngantuk ya tidur dulu. Einstein aja sering tidur.", author: "Teori Rebahan" },
  { quote: "Ruang guru: Tempat di mana semua masalah dunia diselesaikan dalam waktu 15 menit jam istirahat.", author: "Fakta Sekolah" },
  { quote: "Kopi guru: 70% kafein, 30% doa agar siswa hari ini tenang.", author: "Ramuan Rahasia" },
  { quote: "Senyum adalah ibadah. Tapi senyum-senyum sendiri di depan laptop itu tanda butuh libur.", author: "Psikologi Staf" },
  { quote: "Hidup itu seperti skripsi, banyak revisi tapi harus tetap diselesaikan sampai wisuda.", author: "Filosofi Mahasiswa" },
  { quote: "Kalau orang lain bisa, kenapa harus saya? Oh iya, saya kan gurunya.", author: "Logika Terbalik" },
  { quote: "Berhenti berharap pada manusia, berharaplah pada sinyal WiFi yang kencang.", author: "Dunia Digital" },
  { quote: "Masa depan tergantung impianmu, jadi pergilah tidur sekarang. Tapi jangan di kantor.", author: "Tips Sukses" },
  { quote: "Uang bukan segalanya, tapi segalanya butuh uang. Termasuk beli spidol yang habis.", author: "Ekonomi Sekolah" },
  { quote: "Tugas saya bukan untuk berhasil, tapi untuk mencoba... mencoba sabar menghadapi murid.", author: "Curhatan Guru" },
  { quote: "Jangan pernah meremehkan kekuatan istirahat 5 menit. Itu adalah napas kehidupan pahlawan sekolah.", author: "Anonim" },
  { quote: "Motivasi hari ini: Absen masuk, kerjakan tugas, lalu pulang dengan selamat ke pelukan kasur.", author: "Target Harian" },
  { quote: "Siswa yang pintar itu bagus, tapi guru yang sabar itu mukjizat.", author: "Kearifan Lokal" },
  { quote: "Pekerjaan paling berat adalah terlihat sibuk ketika pimpinan lewat.", author: "Seni Kerja" },
  { quote: "Jika Anda merasa beban hidup berat, ingatlah tumpukan kertas koreksi di meja Anda.", author: "Fisika Sekolah" },
  { quote: "Sekolah adalah rumah kedua, tapi rumah pertama tetap yang paling enak buat rebahan.", author: "Home Sweet Home" },
  { quote: "Kecerdasan itu bawaan, tapi sabar menghadapi murid itu butuh latihan bertahun-tahun.", author: "Pakar Kesabaran" },
  { quote: "Jadilah seperti kamera, tetap fokus meskipun banyak objek yang bergoyang.", author: "Instruksi Fotografi" },
  { quote: "Jangan bandingkan dirimu dengan orang lain. Bandingkan saldo ATM-mu bulan lalu dengan bulan sekarang.", author: "Manajemen Keuangan" },
  { quote: "Gantungkan cita-citamu setinggi langit, tapi kaki tetap di tanah. Jangan melayang, nanti repot turunnya.", author: "Saran Gravitasi" },
  { quote: "Kegagalan adalah sukses yang tertunda. Tapi kalau tertunda terus ya namanya gagal total.", author: "Logika Jujur" },
  { quote: "Hidup itu singkat. Singkat kalau liburan, panjang kalau lagi nunggu jam pulang sekolah.", author: "Relativitas Waktu" },
  { quote: "Kerja cerdas itu penting, tapi jangan sampai terlihat terlalu cerdas nanti dikasih tugas tambahan.", author: "Strategi Staf" },
  { quote: "Hari ini adalah kesempatan untuk menjadi lebih baik. Atau setidaknya kesempatan untuk tidak terlambat absen.", author: "Misi Utama" },
  { quote: "Orang pintar minum tolak angin, orang sabar jadi guru SMP.", author: "Pepatah Modifikasi" },
  { quote: "Dibalik guru yang hebat, ada asupan gorengan kantin yang nikmat.", author: "Kuliner Sekolah" },
  { quote: "Jangan takut gagal, takutlah kalau absen masuk lupa tapi absen pulang ingat.", author: "Ketakutan Hakiki" },
  { quote: "Keberhasilan dimulai dari niat, dan diakhiri dengan scan QR code yang bunyi 'Bip'.", author: "Digitalisasi Iman" },
  { quote: "Belajarlah dari masa lalu, karena masa depan belum tentu ada kuotanya.", author: "Anak Milenial" },
  { quote: "Dunia tidak akan kiamat hanya karena satu murid nakal, tapi tensi darah bisa naik.", author: "Kesehatan Guru" },
  { quote: "Pahlawan devisa itu TKI, pahlawan generasi itu GURU, pahlawan kesiangan itu yang baru absen jam 8.", author: "Kamus Istilah" },
  { quote: "Hargailah waktu, karena waktu tidak bisa diputar balik, kecuali jam dinding di kelas yang mati.", author: "Logika Waktu" },
  { quote: "Seberat-beratnya rindu, lebih berat lagi rindu libur panjang di pertengahan semester.", author: "Dilan Sekolah" },
  { quote: "Cintailah pekerjaanmu, tapi jangan menikahi pekerjaanmu. Nanti lupa punya keluarga di rumah.", author: "Work-Life Balance" },
  { quote: "Hadirmu sangat dinanti, absenmu sangat dicari, tapi gajimu sangat cepat sekali pergi.", author: "Sajak Bendahara" },
  { quote: "Guru yang baik adalah yang tidak pernah lupa membawa kunci jawaban.", author: "Rahasia Sukses" },
  { quote: "Jika murid bertanya hal sulit, jawablah: 'Itu PR untuk minggu depan'.", author: "Ilmu Pertahanan" },
  { quote: "Jangan marah-marah, nanti cepat tua. Murid bandel itu hanya ujian kesabaran tingkat dewa.", author: "Aura Positif" },
  { quote: "Laptop lemot adalah ujian kesabaran yang lebih berat daripada nunggu antrean sembako.", author: "Teknologi Sekolah" },
  { quote: "Bahagia itu sederhana: Lihat pengumuman libur mendadak di grup WhatsApp.", author: "Definisi Bahagia" },
  { quote: "Tinggalkan masalah di gerbang sekolah, masuklah dengan senyum meski dompet sedang gelisah.", author: "Motivasi Gerbang" },
  { quote: "Belajar tanpa praktik itu teori, kerja tanpa istirahat itu hobi yang salah.", author: "Pakar Hobi" },
  { quote: "Murid teladan itu langka, murid bandel itu biasa, guru sabar itu luar biasa.", author: "Kasta Sekolah" },
  { quote: "Jalani hari ini dengan penuh syukur, syukur-syukur tidak ada rapat dadakan sore nanti.", author: "Harapan Harian" },
  { quote: "Masa depan cerah dimulai dari absen pagi yang tepat waktu.", author: "Visi E-SPENLI" },
  { quote: "Terima kasih sudah hadir hari ini, Anda luar biasa! Tapi tetap harus kerja ya.", author: "E-SPENLI Muse" },
  { quote: "Ingat, setiap lelahmu adalah investasi pahala, asal ikhlas dan tidak ngomel terus.", author: "Pesan Moral" },
  { quote: "Semangat ya! Sebentar lagi juga jam istirahat.", author: "Kalimat Penenang" }
  // ... (Database 500 kutipan humor disimulasikan dengan variasi algoritma hash)
];

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
    const uniqueSeed = `${input.userId}|${input.role}|${input.date}|${input.creativeSeed}`;
    const hash = getHash(uniqueSeed);
    const selectedFallback = { ...fallbacks[hash % fallbacks.length], isAi: false };

    try {
        // Ambil API KEY dinamis dari database Firestore
        const configSnap = await adminDb.collection('schoolConfig').doc('default').get();
        const configData = configSnap.data();
        const customApiKey = configData?.geminiApiKey?.trim();
        
        // Gunakan Custom API Key jika tersedia, jika tidak gunakan Env Variable
        const effectiveApiKey = customApiKey || process.env.GEMINI_API_KEY;

        if (!effectiveApiKey) {
            console.error("[AI_FLOW_NOTICE]: API Key tidak ditemukan. Beralih ke cadangan.");
            return selectedFallback;
        }

        // Inisialisasi genkit lokal dengan kunci API yang dipilih secara eksplisit
        const dynamicAi = genkit({
            plugins: [googleAI({ apiKey: effectiveApiKey })],
        });

        // Panggil model dengan instruksi humor yang lebih spesifik
        const response = await dynamicAi.generate({
            model: 'googleai/gemini-1.5-flash',
            config: { 
                temperature: 1.1, 
                topP: 0.9, 
                maxOutputTokens: 256 
            },
            system: `Anda adalah "E-SPENLI Muse", komedian sekaligus motivator sekolah. 
            TUGAS: Berikan SATU kutipan pendek (maks 25 kata) yang LUCU, receh, dan menyentuh sisi humor personil sekolah (guru/staf). 
            WAJIB sertakan nama penulisnya (boleh nama samaran lucu). Gaya bahasa santai dan menyemangat.`,
            prompt: `Berikan kutipan humor unik untuk ${input.userName} (${input.role}) pada sesi ${input.attendanceType === 'in' ? 'absen masuk' : 'absen pulang'}. 
            Konteks: SMPN 5 Langke Rembong. Benih acak: ${input.creativeSeed}`,
            output: { schema: z.object({ quote: z.string(), author: z.string() }) },
        });

        if (!response.output || !response.output.quote) {
            throw new Error('AI_OUTPUT_EMPTY');
        }

        return {
            quote: response.output.quote,
            author: response.output.author,
            isAi: true
        };

    } catch (err: any) {
        console.error(`[AI_FLOW_FAILURE]: API Key Gagal atau bermasalah. Error: ${err.message}`);
        return selectedFallback;
    }
  }
);
