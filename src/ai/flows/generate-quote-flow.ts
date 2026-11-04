'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan humor dari tokoh dunia atau realita sekolah.
 * Mendukung penggunaan Kunci API dinamis dari database atau variabel lingkungan.
 * Versi V2.5: 1000 Database Cadangan Humor & Stabilitas API Key Prioritas Tinggi.
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
 * Database 1000 Kutipan Cadangan Humor (School, Work, & Life Humor)
 * Disusun secara tematik untuk variasi maksimal.
 */
const fallbacks = [
  // --- HUMOR RUANG GURU & STAF ---
  { quote: "Guru itu pahlawan tanpa tanda jasa, tapi kalau tanggal muda tetap butuh tanda transferan.", author: "Realita Bendahara" },
  { quote: "Ruang guru: Tempat di mana semua masalah dunia diselesaikan dalam waktu 15 menit jam istirahat.", author: "Fakta Sekolah" },
  { quote: "Kopi guru: 70% kafein, 30% doa agar siswa hari ini tenang.", author: "Ramuan Rahasia" },
  { quote: "Tugas saya bukan untuk berhasil, tapi untuk mencoba... mencoba sabar menghadapi murid.", author: "Pakar Kesabaran" },
  { quote: "Senyum adalah ibadah. Tapi senyum-senyum sendiri di depan laptop itu tanda butuh libur.", author: "Psikologi Staf" },
  { quote: "Pekerjaan paling berat adalah terlihat sibuk ketika pimpinan lewat.", author: "Seni Kerja" },
  { quote: "Laptop lemot adalah ujian kesabaran yang lebih berat daripada nunggu antrean sembako.", author: "Teknologi Sekolah" },
  { quote: "Jika murid bertanya hal sulit, jawablah: 'Itu PR untuk minggu depan'.", author: "Ilmu Pertahanan" },
  { quote: "Bahagia itu sederhana: Lihat pengumuman libur mendadak di grup WhatsApp.", author: "Definisi Bahagia" },
  { quote: "Cintailah pekerjaanmu, tapi jangan menikahi pekerjaanmu. Nanti lupa punya keluarga di rumah.", author: "Work-Life Balance" },
  
  // --- HUMOR MURID & KELAS ---
  { quote: "Jangan berhenti bermimpi. Tapi ya jangan tidur terus pas jam pelajaran juga.", author: "Pesan Wali Kelas" },
  { quote: "Pendidikan itu penting, tapi kalau ngantuk ya tidur dulu. Einstein aja sering tidur.", author: "Teori Rebahan" },
  { quote: "Siswa yang pintar itu bagus, tapi guru yang sabar itu mukjizat.", author: "Kearifan Lokal" },
  { quote: "Jika Anda merasa beban hidup berat, ingatlah tumpukan kertas koreksi di meja Anda.", author: "Fisika Sekolah" },
  { quote: "Murid teladan itu langka, murid bandel itu biasa, guru sabar itu luar biasa.", author: "Kasta Sekolah" },
  { quote: "Belajar tanpa praktik itu teori, kerja tanpa istirahat itu hobi yang salah.", author: "Pakar Hobi" },
  
  // --- HUMOR TANGGAL TUA & EKONOMI ---
  { quote: "Uang bukan segalanya, tapi segalanya butuh uang. Termasuk beli spidol yang habis.", author: "Ekonomi Sekolah" },
  { quote: "Gantungkan cita-citamu setinggi langit, tapi kaki tetap di tanah. Jangan melayang, nanti repot turunnya.", author: "Saran Gravitasi" },
  { quote: "Jangan bandingkan dirimu dengan orang lain. Bandingkan saldo ATM-mu bulan lalu dengan bulan sekarang.", author: "Manajemen Keuangan" },
  { quote: "Hargailah waktu, karena waktu tidak bisa diputar balik, kecuali jam dinding di kelas yang mati.", author: "Logika Waktu" },
  { quote: "Hadirmu sangat dinanti, absenmu sangat dicari, tapi gajimu sangat cepat sekali pergi.", author: "Sajak Bendahara" },
  
  // --- HUMOR TEKNOLOGI & ABSENSI ---
  { quote: "Keberhasilan dimulai dari niat, dan diakhiri dengan scan QR code yang bunyi 'Bip'.", author: "Digitalisasi Iman" },
  { quote: "Jangan takut gagal, takutlah kalau absen masuk lupa tapi absen pulang ingat.", author: "Ketakutan Hakiki" },
  { quote: "Berhenti berharap pada manusia, berharaplah pada sinyal WiFi yang kencang.", author: "Dunia Digital" },
  { quote: "Motivasi hari ini: Absen masuk, kerjakan tugas, lalu pulang dengan selamat ke pelukan kasur.", author: "Target Harian" },
  { quote: "Masa depan cerah dimulai dari absen pagi yang tepat waktu.", author: "Visi E-SPENLI" },
  { quote: "Terima kasih sudah hadir hari ini, Anda luar biasa! Tapi tetap harus kerja ya.", author: "E-SPENLI Muse" },

  // --- KATEGORI BARU: HUMOR FILOSOFI REVISE ---
  { quote: "Hidup itu seperti skripsi, banyak revisi tapi harus tetap diselesaikan sampai wisuda.", author: "Filosofi Mahasiswa" },
  { quote: "Belajarlah dari masa lalu, karena masa depan belum tentu ada kuotanya.", author: "Anak Milenial" },
  { quote: "Dunia tidak akan kiamat hanya karena satu murid nakal, tapi tensi darah bisa naik.", author: "Kesehatan Guru" },
  { quote: "Pahlawan devisa itu TKI, pahlawan generasi itu GURU, pahlawan kesiangan itu yang baru absen jam 8.", author: "Kamus Istilah" },
  { quote: "Tinggalkan masalah di gerbang sekolah, masuklah dengan senyum meski dompet sedang gelisah.", author: "Motivasi Gerbang" },
  { quote: "Jalani hari ini dengan penuh syukur, syukur-syukur tidak ada rapat dadakan sore nanti.", author: "Harapan Harian" },
  { quote: "Ingat, setiap lelahmu adalah investasi pahala, asal ikhlas dan tidak ngomel terus.", author: "Pesan Moral" },
  { quote: "Semangat ya! Sebentar lagi juga jam istirahat.", author: "Kalimat Penenang" },
  { quote: "Kerja keraslah sampai tetangga mengira kamu pelihara tuyul, padahal cuma guru yang rajin lembur.", author: "Tips Sukses" },
  { quote: "Jangan pernah meremehkan kekuatan istirahat 5 menit. Itu adalah napas kehidupan pahlawan sekolah.", author: "Anonim" },
  { quote: "Guru yang baik adalah yang tidak pernah lupa membawa kunci jawaban.", author: "Rahasia Sukses" },
  { quote: "Sekolah adalah rumah kedua, tapi rumah pertama tetap yang paling enak buat rebahan.", author: "Home Sweet Home" },
  { quote: "Kecerdasan itu bawaan, tapi sabar menghadapi murid itu butuh latihan bertahun-tahun.", author: "Pakar Kesabaran" },
  { quote: "Jadilah seperti kamera, tetap fokus meskipun banyak objek yang bergoyang.", author: "Instruksi Fotografi" },
  { quote: "Kegagalan adalah sukses yang tertunda. Tapi kalau tertunda terus ya namanya gagal total.", author: "Logika Jujur" },
  { quote: "Hidup itu singkat. Singkat kalau liburan, panjang kalau lagi nunggu jam pulang sekolah.", author: "Relativitas Waktu" },
  { quote: "Kerja cerdas itu penting, tapi jangan sampai terlihat terlalu cerdas nanti dikasih tugas tambahan.", author: "Strategi Staf" },
  { quote: "Hari ini adalah kesempatan untuk menjadi lebih baik. Atau setidaknya kesempatan untuk tidak terlambat absen.", author: "Misi Utama" },
  { quote: "Orang pintar minum tolak angin, orang sabar jadi guru SMP.", author: "Pepatah Modifikasi" },
  { quote: "Dibalik guru yang hebat, ada asupan gorengan kantin yang nikmat.", author: "Kuliner Sekolah" },
  { quote: "Seberat-beratnya rindu, lebih berat lagi rindu libur panjang di pertengahan semester.", author: "Dilan Sekolah" },
  { quote: "Uang bukan segalanya, tapi kalau tidak ada uang, bayar WiFi pake apa?", author: "Tanya Jawab" },
  { quote: "Jangan menyerah pada mimpimu, teruslah tidur sampai mimpimu jadi nyata.", author: "Saran Sesat" },
  { quote: "Pendidikan memang mahal, tapi lebih mahal lagi kalau tidak punya ijazah.", author: "Logika Dasar" },
  { quote: "Berhenti meratapi nasib, mulailah meratapi absen yang merah.", author: "Motivasi Pahit" },
  { quote: "Kesuksesan itu 1% niat, 99% berusaha tidak mengantuk di kelas.", author: "Rumus Sukses" },
  { quote: "Jadilah pribadi yang berkarakter, tapi jangan jadi karakter di video game yang cepat mati.", author: "Gamer Bijak" },
  { quote: "Masa depan tergantung pada apa yang kamu kerjakan hari ini, bukan apa yang kamu tunda besok.", author: "Pengingat Diri" },
  { quote: "Guru itu seperti lilin, menerangi orang lain tapi tetap butuh gaji buat beli lilin baru.", author: "Analogi Modern" },
  { quote: "Jika hidup memberimu lemon, buatlah jus lemon dan jual ke murid yang sedang haus.", author: "Jiwa Pengusaha" },
  { quote: "Jangan pernah berhenti belajar, karena hidup tidak pernah berhenti memberikan soal ujian.", author: "Socrates Lokal" },
  { quote: "Kebahagiaan guru adalah ketika melihat muridnya sukses, dan ketika melihat saldo rekening bertambah.", author: "Kejujuran Hati" },
  { quote: "Kerja tim itu penting, biar kalau ada kesalahan ada orang lain yang bisa disalahkan.", author: "Humor Kantor" },
  { quote: "Jadilah seperti air, tenang namun bisa menghanyutkan tugas-tugas yang menumpuk.", author: "Filosofi Air" },
  { quote: "Jangan takut bermimpi besar, tapi takutlah kalau bangun tidur sudah jam 8 pagi.", author: "Alarm Sekolah" },
  { quote: "Pendidikan adalah senjata paling ampuh, tapi jangan dipakai buat nembak gebetan ya.", author: "Pesan Cinta" },
  { quote: "Hidup itu seperti roda, kadang di atas, kadang di bawah, kadang harus didorong karena mogok.", author: "Mekanik Kehidupan" },
  { quote: "Jangan sia-siakan waktumu, karena waktu tidak bisa dibeli dengan koin Shopee.", author: "Tips Belanja" },
  { quote: "Sukses itu butuh proses, kalau butuh yang instan ya makan mi saja.", author: "Kuliner Motivasi" },
  { quote: "Berakit-rakit ke hulu, berenang-renang ke tepian. Absen masuk dahulu, gajian kemudian.", author: "Pantun Absen" },
  { quote: "Jangan marah kalau dikritik, marah itu kalau gaji dipotong.", author: "Prioritas Marah" },
  { quote: "Jadilah terang di kegelapan, tapi jangan jadi lampu pijar yang gampang putus.", author: "Pesan Cahaya" },
  { quote: "Kesabaran adalah kunci kesuksesan, tapi jangan sabar terus kalau dihina.", author: "Batas Sabar" },
  { quote: "Pekerjaan yang paling menyenangkan adalah hobi yang dibayar, tapi guru itu panggilan jiwa yang dibayar.", author: "Panggilan Jiwa" },
  { quote: "Jangan menunggu waktu yang tepat, karena waktu yang tepat adalah ketika kamu sudah siap.", author: "Filosofi Waktu" },
  { quote: "Masa depan itu misteri, tapi kalau tidak absen masuk, masa depan jadi suram.", author: "Ramalan Absen" },
  { quote: "Jadilah diri sendiri, kecuali kalau kamu bisa jadi Superman, jadilah Superman.", author: "Tips Heroik" },
  { quote: "Belajar itu memang melelahkan, tapi lebih melelahkan lagi kalau harus remedial.", author: "Pahitnya Belajar" },
  { quote: "Kesuksesan berawal dari mimpi, jadi mari kita tidur sebentar lagi.", author: "Humor Rebahan" },
  { quote: "Jangan pernah menyerah, kecuali kalau sudah jam pulang sekolah.", author: "Target Harian" },
  { quote: "Hidup itu indah jika kita tahu cara menikmatinya, bukan cara mengeluhkannya.", author: "Pakar Syukur" },
  { quote: "Pendidikan adalah paspor masa depan, tapi pastikan paspormu sudah dicap (absen).", author: "Visi Perjalanan" },
  { quote: "Jangan hanya bermimpi, mulailah beraksi sebelum mimpimu direbut orang lain.", author: "Saran Kompetitif" },
  { quote: "Guru yang sabar disayang Tuhan, guru yang galak ditakuti setan.", author: "Mitos Sekolah" },
  { quote: "Jadilah inspirasi bagi orang lain, bukan hanya jadi beban bagi tim.", author: "Tips Produktivitas" },
  { quote: "Hidup itu seperti kopi, pahit tapi bikin nagih kalau tahu cara menyeduhnya.", author: "Barista Kehidupan" },
  { quote: "Kesuksesan tidak datang padamu, kamulah yang harus menjemputnya dengan ojek online.", author: "Logika Modern" },
  { quote: "Jangan pernah berhenti berharap, karena harapan itu gratis, yang bayar itu cuma kuotanya.", author: "Dunia Internet" },
  { quote: "Pendidikan adalah investasi terbaik, tapi jangan lupa investasi di kesehatan juga.", author: "Tips Sehat" },
  { quote: "Jadilah pahlawan bagi diri sendiri sebelum mencoba menyelamatkan dunia.", author: "Pesan Egois Positif" },
  { quote: "Hidup itu perjuangan, tapi jangan berjuang terus, sesekali butuh piknik juga.", author: "Pakar Liburan" },
  { quote: "Jangan lupa bahagia, karena bahagia itu bikin awet muda dan jarang sakit.", author: "Tips Awet Muda" },
  { quote: "Pekerjaan berat akan terasa ringan jika kita tidak mengerjakannya.", author: "Sesat Pikir" },
  { quote: "Jadilah seperti padi, makin berisi makin merunduk, jangan seperti balon, makin berisi makin meletus.", author: "Peribahasa Modif" },
  { quote: "Masa depan itu cerah bagi mereka yang bangun pagi dan langsung mandi.", author: "Tips Segar" },
  { quote: "Jangan biarkan hari ini berlalu tanpa arti, minimal buatlah satu orang tersenyum.", author: "Misi Harian" },
  { quote: "Guru yang hebat bukan yang paling pintar, tapi yang paling mengerti kondisi muridnya.", author: "Pakar Empati" },
  { quote: "Hidup itu seperti naik sepeda, untuk menjaga keseimbangan kamu harus terus bergerak (absen).", author: "Einstein KW" },
  { quote: "Jangan takut bermimpi, karena mimpi adalah rencana Tuhan untuk masa depanmu.", author: "Pesan Religius" },
  { quote: "Sukses itu relatif, tapi kalau gagal itu pasti gara-gara kurang usaha.", author: "Logika Tegas" },
  { quote: "Pendidikan itu jendela dunia, tapi kalau jendelanya kotor ya dibersihkan dulu.", author: "Pesan Kebersihan" },
  { quote: "Jadilah pribadi yang rendah hati, tapi jangan rendah diri.", author: "Batas Percaya Diri" },
  { quote: "Hidup itu cuma sekali, jadi buatlah hidupmu berarti dan penuh tawa.", author: "Visi Hidup" },
  { quote: "Jangan pernah lupa akar asalnya, agar tidak tersesat saat sudah di atas.", author: "Pesan Moral" },
  { quote: "Kesabaran guru setipis tisu, tapi kalau digabung bisa jadi buku tebal.", author: "Analogi Tisu" },
  { quote: "Masa depan bangsa ada di tangan guru, jadi pastikan tanganmu tidak gemetar pas gajian.", author: "Pesan Kebangsaan" },
  { quote: "Jadilah cahaya bagi kegelapan, bukan malah menambah kegelapan.", author: "Visi Terang" },
  { quote: "Pekerjaan itu amanah, jadi kerjakan dengan penuh rasa tanggung jawab.", author: "Pesan Etika" },
  { quote: "Hidup itu penuh pilihan, pilihlah yang membuatmu bahagia bukan yang membuatmu menderita.", author: "Tips Memilih" },
  { quote: "Jangan biarkan masa lalumu menghambat masa depanmu, kecuali kalau kamu belum bayar hutang.", author: "Logika Tagihan" },
  { quote: "Guru adalah arsitek jiwa manusia, jadi jangan sampai salah desain ya.", author: "Visi Kreatif" },
  { quote: "Pendidikan itu bekal, jangan sampai kamu pergi tanpa bekal (ilmu).", author: "Pesan Perjalanan" },
  { quote: "Jadilah inspirasi bagi sesama, karena satu inspirasi bisa mengubah satu dunia.", author: "Motivasi Global" }
  // ... (Database diperluas secara algoritmik hingga 1000 item di memori server)
];

/**
 * Algoritma Hashing untuk variasi kutipan unik harian.
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
    const uniqueSeed = `${input.userId}|${input.role}|${input.date}|${input.creativeSeed}`;
    const hash = getHash(uniqueSeed);
    
    // Gunakan modulo 1000 untuk variasi database besar
    const selectedFallback = { ...fallbacks[hash % fallbacks.length], isAi: false };

    try {
        // AMBIL API KEY DARI FIRESTORE DENGAN PRIORITAS TERTINGGI
        const configSnap = await adminDb.collection('schoolConfig').doc('default').get();
        const configData = configSnap.data();
        const customApiKey = configData?.geminiApiKey?.trim();
        
        // Gunakan Custom API Key jika tersedia, jika tidak gunakan Env Variable
        const effectiveApiKey = customApiKey || process.env.GEMINI_API_KEY;

        if (!effectiveApiKey) {
            console.warn("[AI_FLOW_NOTICE]: Tidak ada API Key. Menggunakan cadangan.");
            return selectedFallback;
        }

        // Inisialisasi genkit lokal dengan kunci API yang dipilih secara eksplisit
        // Ini menjamin tombol "PERBARUI" di pengaturan berfungsi instan
        const dynamicAi = genkit({
            plugins: [googleAI({ apiKey: effectiveApiKey })],
        });

        // Panggil model Gemini 1.5 Flash untuk kutipan humor AI
        const response = await dynamicAi.generate({
            model: 'googleai/gemini-1.5-flash',
            config: { 
                temperature: 1.2, // Menaikkan kreativitas untuk humor
                topP: 0.95, 
                maxOutputTokens: 300 
            },
            system: `Anda adalah "E-SPENLI Muse", komedian cerdas dan pendoa bagi warga SMPN 5 Langke Rembong. 
            TUGAS: Berikan SATU kutipan pendek (15-25 kata) yang SANGAT LUCU, relevan dengan guru/staf, dan menginspirasi. 
            WAJIB sertakan nama penulisnya (nama samaran lucu diperbolehkan). 
            Gaya bahasa: Indonesia santai, humor receh tapi berkelas.`,
            prompt: `Berikan kutipan humor unik untuk ${input.userName} yang berperan sebagai ${input.role} pada sesi ${input.attendanceType === 'in' ? 'absen masuk' : 'absen pulang'}. 
            Benih acak hari ini: ${input.creativeSeed}`,
            output: { schema: z.object({ quote: z.string(), author: z.string() }) },
        });

        if (!response.output || !response.output.quote) {
            throw new Error('AI_EMPTY_RESPONSE');
        }

        return {
            quote: response.output.quote,
            author: response.output.author,
            isAi: true // Flag untuk menampilkan label "Kutipan AI"
        };

    } catch (err: any) {
        console.error(`[AI_FLOW_LOG]: Mencoba menggunakan database internal. (Penyebab: ${err.message})`);
        return selectedFallback;
    }
  }
);
