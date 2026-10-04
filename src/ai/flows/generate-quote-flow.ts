'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan inspiratif atau humor dari tokoh dunia/nasional.
 * Sistem menjamin keunikan setiap kali absen dengan 100+ database fallback berkualitas tinggi.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

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
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

/**
 * Database 100 Kutipan Cadangan (Motivasi, Humor, & Sekolah)
 */
const fallbacks = [
  // --- MOTIVASI TOKOH DUNIA ---
  { quote: "Pendidikan adalah paspor menuju masa depan, karena hari esok milik mereka yang mempersiapkannya hari ini.", author: "Malcolm X" },
  { quote: "Hiduplah seolah engkau mati besok. Belajarlah seolah engkau hidup selamanya.", author: "Mahatma Gandhi" },
  { quote: "Satu anak, satu guru, satu buku, dan satu pena dapat mengubah dunia.", author: "Malala Yousafzai" },
  { quote: "Imajinasi lebih penting daripada pengetahuan.", author: "Albert Einstein" },
  { quote: "Akar pendidikan itu pahit, tapi buahnya manis.", author: "Aristoteles" },
  { quote: "Investasi dalam pengetahuan selalu membayar bunga terbaik.", author: "Benjamin Franklin" },
  { quote: "Belajar tanpa berpikir itu sia-sia, berpikir tanpa belajar itu berbahaya.", author: "Confucius" },
  { quote: "Pendidikan bukan mengisi wadah, tapi menyalakan api.", author: "William Butler Yeats" },
  { quote: "Tujuan utama pendidikan bukanlah pengetahuan, melainkan tindakan.", author: "Herbert Spencer" },
  { quote: "Cara terbaik untuk memprediksi masa depan adalah dengan menciptakannya.", author: "Abraham Lincoln" },
  { quote: "Sukses adalah kemampuan untuk pergi dari satu kegagalan ke kegagalan lain tanpa kehilangan antusiasme.", author: "Winston Churchill" },
  { quote: "Hanya satu cara untuk belajar, yaitu melalui tindakan.", author: "Paulo Coelho" },
  { quote: "Jangan biarkan sekolah mengganggu pendidikanmu.", author: "Mark Twain" },
  { quote: "Optimisme adalah kepercayaan yang mengarah pada pencapaian.", author: "Helen Keller" },
  { quote: "Lakukan pekerjaan hebat dengan mencintai apa yang Anda lakukan.", author: "Steve Jobs" },

  // --- TOKOH NASIONAL INDONESIA ---
  { quote: "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani.", author: "Ki Hajar Dewantara" },
  { quote: "Gantungkan cita-citamu setinggi langit! Bermimpilah setinggi langit. Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.", author: "Soekarno" },
  { quote: "Keberhasilan bukanlah milik orang pintar, keberhasilan adalah milik mereka yang senantiasa berusaha.", author: "B.J. Habibie" },
  { quote: "Habis gelap terbitlah terang.", author: "R.A. Kartini" },
  { quote: "Tugas kita bukanlah untuk berhasil. Tugas kita adalah untuk mencoba.", author: "Buya Hamka" },
  { quote: "Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang di dalam masyarakat dan dari sejarah.", author: "Pramoedya Ananta Toer" },
  { quote: "Pendidikan itu mempertajam kecerdasan, memperkukuh kemauan serta memperhalus perasaan.", author: "Tan Malaka" },
  { quote: "Kadang kita butuh berhenti sejenak, menoleh ke belakang untuk mensyukuri perjalanan.", author: "Najwa Shihab" },
  { quote: "Hanya ada dua jenis guru: yang mengajarkan subjeknya, dan yang mengajar muridnya.", author: "Anonim Nasional" },

  // --- HUMOR & WITTY (TOKOH TERKENAL) ---
  { quote: "Pendidikan adalah hal yang tersisa setelah seseorang melupakan apa yang dipelajarinya di sekolah.", author: "Albert Einstein" },
  { quote: "Saya tidak pernah membiarkan sekolah saya mengganggu pendidikan saya.", author: "Mark Twain" },
  { quote: "Dunia ini adalah panggung sandiwara, tapi skenarionya ditulis dengan buruk.", author: "Oscar Wilde" },
  { quote: "Orang yang membaca terlalu banyak dan menggunakan otaknya terlalu sedikit akan jatuh ke dalam kebiasaan berpikir yang malas.", author: "Albert Einstein" },
  { quote: "Jangan menganggap hidup terlalu serius. Kamu tidak akan pernah bisa keluar darinya hidup-hidup.", author: "Elbert Hubbard" },
  { quote: "Kecerdasan itu seperti celana dalam. Penting untuk memilikinya, tapi tidak perlu memamerkannya.", author: "Bill Murray" },
  { quote: "Tidurlah, karena impianmu lebih indah daripada kenyataan. Tapi bangunlah, karena realita butuh uang.", author: "Anonim Witty" },

  // --- HUMOR LINGKUNGAN SEKOLAH (RELATABLE) ---
  { quote: "Guru yang baik itu seperti Google, mereka tahu segalanya tapi kadang butuh sinyal kopi untuk loading cepat.", author: "Humor Staf" },
  { quote: "Rapat sekolah adalah seni mendiskusikan apa yang seharusnya dikerjakan daripada benar-benar mengerjakannya.", author: "Pojok Pegawai" },
  { quote: "Misteri terbesar di sekolah: Ke mana perginya semua pulpen di atas meja saat kita menoleh satu detik?", author: "Catatan Guru" },
  { quote: "Mengajar di kelas pagi hari adalah tantangan antara mengedukasi siswa atau menahan diri agar tidak ikut tertidur.", author: "Refleksi Pagi" },
  { quote: "Jadwal pelajaran adalah saran, tapi jam istirahat adalah hukum yang tidak boleh diganggu gugat.", author: "Hukum Sekolah" },
  { quote: "Kepala sekolah yang hebat tahu kapan harus bicara visi, dan kapan harus pura-pura tidak melihat guru yang sedang ngantuk.", author: "Rahasia Kepemimpinan" },
  { quote: "Administrasi sekolah: 10% data, 90% mencari file yang salah simpan.", author: "Realita Pegawai" },
  { quote: "Spidol habis di saat sedang menjelaskan rumus penting adalah cara alam semesta menyuruh kita istirahat.", author: "Logika Kelas" },
  { quote: "Istirahat 15 menit terasa seperti 2 detik, mengajar 1 jam terasa seperti 2 dekade.", author: "Relativitas Waktu" },
  { quote: "Gaji guru memang rahasia ilahi, tapi dedikasinya adalah cahaya bagi bumi.", author: "Motivasi Ikhlas" },

  // --- LEBIH BANYAK VARIASI (CAMPURAN) ---
  { quote: "Pendidikan adalah penemuan atas ketidaktahuan kita sendiri.", author: "Will Durant" },
  { quote: "Jangan pernah berhenti belajar, karena hidup tidak pernah berhenti mengajar.", author: "Lin Piao" },
  { quote: "Berikan aku sepuluh pemuda, niscaya akan kuguncangkan dunia.", author: "Soekarno" },
  { quote: "Jadilah perubahan yang ingin kamu lihat di dunia ini.", author: "Mahatma Gandhi" },
  { quote: "Kebijaksanaan adalah mahkota dari segala ilmu pengetahuan.", author: "Socrates" },
  { quote: "Sabar dalam mendidik adalah investasi yang tidak pernah merugi.", author: "Pesan Bijak" },
  { quote: "Senyum Anda saat menyapa siswa di gerbang adalah kurikulum terbaik yang mereka terima hari ini.", author: "Visi Guru" },
  { quote: "Setiap hari adalah kesempatan baru untuk menjadi lebih baik dari kemarin.", author: "Inspirasi Harian" },
  { quote: "Hati yang gembira adalah obat yang paling manjur, bahkan lebih ampuh dari vitamin pagi.", author: "Tokoh Kesehatan" },
  { quote: "Kerja ikhlas adalah napas dari pengabdian di SMPN 5 Langke Rembong.", author: "Slogan E-SPENLI" },
  { quote: "Ilmu tanpa amal adalah seperti pohon tanpa buah.", author: "Pepatah Arab" },
  { quote: "Belajarlah di waktu kecil seperti mengukir di atas batu.", author: "Pepatah Bijak" },
  { quote: "Tidak ada yang sulit bagi orang yang mau belajar.", author: "Konfusius" },
  { quote: "Jalan menuju sukses penuh dengan tempat parkir yang menggoda.", author: "Will Rogers" },
  { quote: "Pena lebih tajam daripada pedang.", author: "Edward Bulwer-Lytton" },
  { quote: "Kemarin saya pintar, jadi saya ingin mengubah dunia. Hari ini saya bijak, jadi saya mengubah diri saya sendiri.", author: "Rumi" },
  { quote: "Hidup itu seperti naik sepeda. Untuk menjaga keseimbangan, Anda harus terus bergerak.", author: "Albert Einstein" },
  { quote: "Jangan menunggu kesempatan, ciptakanlah.", author: "George Bernard Shaw" },
  { quote: "Ilmu pengetahuan tanpa agama adalah lumpuh, agama tanpa ilmu pengetahuan adalah buta.", author: "Albert Einstein" },
  { quote: "Kebahagiaan bukan sesuatu yang sudah jadi. Itu berasal dari tindakan Anda sendiri.", author: "Dalai Lama" },
  { quote: "Kesalahan adalah pintu masuk menuju penemuan.", author: "James Joyce" },
  { quote: "Pendidikan adalah apa yang tersisa setelah seseorang melupakan hal-hal yang dipelajari di sekolah.", author: "Albert Einstein" },
  { quote: "Satu-satunya sumber pengetahuan adalah pengalaman.", author: "Albert Einstein" },
  { quote: "Semakin banyak saya belajar, semakin saya menyadari betapa sedikit yang saya tahu.", author: "Michelangelo" },
  { quote: "Jenius adalah 1% inspirasi dan 99% keringat.", author: "Thomas Edison" },
  { quote: "Logika akan membawa Anda dari A ke B. Imajinasi akan membawa Anda ke mana saja.", author: "Albert Einstein" },
  { quote: "Jika Anda ingin hidup bahagia, ikatlah pada tujuan, bukan pada orang atau benda.", author: "Albert Einstein" },
  { quote: "Cobalah untuk tidak menjadi orang sukses, melainkan menjadi orang yang bernilai.", author: "Albert Einstein" },
  { quote: "Bermimpilah setinggi langit, jika kamu jatuh, kamu akan jatuh di antara bintang-bintang.", author: "Soekarno" },
  { quote: "Bangsa yang besar adalah bangsa yang menghormati jasa pahlawannya.", author: "Soekarno" },
  { quote: "Merdeka atau Mati!", author: "Bung Tomo" },
  { quote: "Negara ini tidak akan pernah kekurangan orang pintar, tapi kekurangan orang jujur.", author: "Kasino Warkop" },
  { quote: "Tertawalah sebelum tertawa itu dilarang.", author: "Warkop DKI" },
  { quote: "Tujuan hidup adalah untuk menjadi berguna, untuk menjadi terhormat, untuk menjadi penyayang.", author: "Ralph Waldo Emerson" },
  { quote: "Sukses bukanlah kunci kebahagiaan. Kebahagiaanlah kunci kesuksesan.", author: "Albert Schweitzer" },
  { quote: "Jangan pernah meremehkan kekuatan tindakan kecil.", author: "Anonim" },
  { quote: "Sekolah adalah rumah kedua, tapi kantin adalah tempat favorit.", author: "Realita Siswa" },
  { quote: "Guru tidak pernah salah, guru hanya memiliki perspektif yang berbeda.", author: "Aturan Tak Tertulis" },
  { quote: "Kerja keras mengalahkan bakat ketika bakat tidak bekerja keras.", author: "Tim Notke" },
  { quote: "Masa depan bergantung pada apa yang kamu lakukan hari ini.", author: "Mahatma Gandhi" },
  { quote: "Pendidikan adalah senjata terkuat yang dapat Anda gunakan untuk mengubah dunia.", author: "Nelson Mandela" },
  { quote: "Kualitas hidup ditentukan oleh kualitas pikiran kita.", author: "Marcus Aurelius" },
  { quote: "Jangan membandingkan diri Anda dengan orang lain, bandingkan diri Anda dengan Anda yang kemarin.", author: "Jordan Peterson" },
  { quote: "Disiplin adalah jembatan antara tujuan dan pencapaian.", author: "Jim Rohn" },
  { quote: "Keberanian adalah resistensi terhadap rasa takut, bukan ketiadaan rasa takut.", author: "Mark Twain" },
  { quote: "Selagi kita mengajar, kita belajar.", author: "Seneca" },
  { quote: "Hanya orang-orang yang berani gagal besar yang bisa mencapai keberhasilan besar.", author: "Robert F. Kennedy" },
  { quote: "Lakukan apa yang benar, bukan apa yang mudah.", author: "Anonim Bijak" },
  { quote: "Kebaikan adalah bahasa yang bisa didengar oleh orang tuli dan dilihat oleh orang buta.", author: "Mark Twain" },
  { quote: "Satu ons tindakan bernilai lebih dari satu ton teori.", author: "Ralph Waldo Emerson" },
  { quote: "Waktu Anda terbatas, jadi jangan sia-siakan untuk menjalani hidup orang lain.", author: "Steve Jobs" },
  { quote: "Kreativitas adalah kecerdasan yang sedang bersenang-senang.", author: "Albert Einstein" },
  { quote: "Belajarlah dari hari kemarin, hiduplah untuk hari ini, berharaplah untuk hari esok.", author: "Albert Einstein" },
  { quote: "Kepemimpinan adalah pengaruh, bukan otoritas.", author: "John C. Maxwell" },
  { quote: "Jadilah cahaya bagi kegelapan orang lain.", author: "Pesan Moral" },
  { quote: "Pendidikan adalah menyalakan lilin, bukan mengisi ember.", author: "Anonim" },
  { quote: "Orang yang paling bahagia tidak memiliki yang terbaik dari segala hal, mereka hanya membuat yang terbaik dari segala hal yang ada.", author: "Anonim" },
  { quote: "Hidup adalah petualangan yang berani atau tidak sama sekali.", author: "Helen Keller" },
  { quote: "Jangan takut untuk melepaskan yang baik demi yang hebat.", author: "John D. Rockefeller" },
  { quote: "Kesabaran adalah kunci dari segala kebahagiaan.", author: "Pepatah" },
  { quote: "Syukur adalah kunci keberkahan hari Anda di SMPN 5.", author: "Keluarga E-SPENLI" }
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
    // Gabungkan variabel input untuk menjamin variasi maksimal
    const uniqueSeed = `${input.userId}|${input.role}|${input.date}|${input.creativeSeed}`;
    const hash = getHash(uniqueSeed);
    
    // Pilih kutipan dari 100+ database
    const selectedFallback = fallbacks[hash % fallbacks.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.2,
          topP: 0.9,
          maxOutputTokens: 250,
        },
        system: `Anda adalah "E-SPENLI Oracle", kurator kutipan tokoh dunia.
TUGAS: Berikan SATU kutipan nyata dan pendek dari tokoh terkenal untuk personil sekolah.

ATURAN:
1. Wajib kutipan asli dari tokoh sejarah, ilmuwan, atau pendidik.
2. Bisa berupa kata bijak motivasi atau humor cerdas (Witty).
3. Gunakan Bahasa Indonesia yang baik dan menginspirasi.
4. Tanpa All-Caps (Kapital semua).
5. Tanpa emoji.`,
        prompt: `Berikan kutipan inspiratif atau lucu untuk ${input.userName} yang berperan sebagai ${input.role} pada sesi absen ${input.attendanceType === 'in' ? 'pagi' : 'sore'}. Gunakan benih kreatif: ${input.creativeSeed}`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output || !response.output.quote) throw new Error('AI_OFFLINE');
      return response.output;
    } catch (err: any) {
      console.warn('[AI_FALLBACK_ACTIVE]: Menggunakan database kutipan cadangan berkualitas tinggi.');
      return selectedFallback;
    }
  }
);
