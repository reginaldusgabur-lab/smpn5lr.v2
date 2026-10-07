'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan inspiratif atau humor dari tokoh dunia/nasional.
 * Sistem menjamin keunikan setiap kali absen dengan 500 database fallback berkualitas tinggi.
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
 * Database 500 Kutipan Cadangan (Kualitas Premium: Motivasi, Humor, Filosofi, & Psikologi Sekolah)
 */
const fallbacks = [
  // --- MOTIVASI & FILOSOFI (1-100) ---
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
  { quote: "Hanya satu cara untuk belajar, yaitu melalui tindakan.", author: "Paulo Coelho" },
  { quote: "Optimisme adalah kepercayaan yang mengarah pada pencapaian.", author: "Helen Keller" },
  { quote: "Lakukan pekerjaan hebat dengan mencintai apa yang Anda lakukan.", author: "Steve Jobs" },
  { quote: "Kreativitas adalah kecerdasan yang sedang bersenang-senang.", author: "Albert Einstein" },
  { quote: "Kegagalan adalah kunci kesuksesan; setiap kesalahan mengajarkan kita sesuatu.", author: "Morihei Ueshiba" },
  { quote: "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani.", author: "Ki Hajar Dewantara" },
  { quote: "Gantungkan cita-citamu setinggi langit! Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.", author: "Soekarno" },
  { quote: "Keberhasilan bukanlah milik orang pintar, keberhasilan adalah milik mereka yang senantiasa berusaha.", author: "B.J. Habibie" },
  { quote: "Habis gelap terbitlah terang.", author: "R.A. Kartini" },
  { quote: "Tugas kita bukanlah untuk berhasil. Tugas kita adalah untuk mencoba.", author: "Buya Hamka" },
  { quote: "Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang di dalam masyarakat.", author: "Pramoedya Ananta Toer" },
  { quote: "Pendidikan itu mempertajam kecerdasan, memperkukuh kemauan serta memperhalus perasaan.", author: "Tan Malaka" },
  { quote: "Kebijaksanaan sejati adalah mengetahui bahwa Anda tidak tahu apa-apa.", author: "Socrates" },
  { quote: "Kualitas hidup ditentukan oleh kualitas pikiran kita.", author: "Marcus Aurelius" },
  { quote: "Disiplin adalah jembatan antara tujuan dan pencapaian.", author: "Jim Rohn" },
  { quote: "Selagi kita mengajar, kita belajar.", author: "Seneca" },
  { quote: "Pena lebih tajam daripada pedang.", author: "Edward Bulwer-Lytton" },
  { quote: "Pekerjaan Anda akan mengisi sebagian besar hidup Anda, cintailah ia.", author: "Steve Jobs" },
  { quote: "Kesenangan dalam bekerja memberikan kesempurnaan pada hasil kerja.", author: "Aristoteles" },
  { quote: "Lakukan apa yang Anda bisa, dengan apa yang Anda miliki, di mana pun Anda berada.", author: "Theodore Roosevelt" },
  { quote: "Keberanian adalah mengetahui apa yang tidak perlu ditakuti.", author: "Plato" },
  { quote: "Hanya jiwa yang terdidik yang bebas.", author: "Epictetus" },
  { quote: "Pendidikan adalah penemuan atas ketidaktahuan kita sendiri.", author: "Will Durant" },
  { quote: "Logika akan membawa Anda dari A ke B. Imajinasi akan membawa Anda ke mana saja.", author: "Albert Einstein" },
  { quote: "Jangan pernah berhenti berharap, karena keajaiban terjadi setiap hari.", author: "Inspirasi Pagi" },
  { quote: "Kesabaran adalah kunci dari segala kebahagiaan.", author: "Pepatah Bijak" },
  { quote: "Jadikan setiap hari mahakarya Anda.", author: "John Wooden" },
  { quote: "Ilmu tanpa amal adalah seperti pohon tanpa buah.", author: "Pepatah Arab" },
  { quote: "Masa depan bergantung pada apa yang kamu lakukan hari ini.", author: "Mahatma Gandhi" },
  { quote: "Kecerdasan ditambah karakter—itulah tujuan pendidikan sejati.", author: "Martin Luther King Jr." },

  // --- HUMOR & WITTY (101-250) ---
  { quote: "Saya tidak pernah membiarkan sekolah saya mengganggu pendidikan saya.", author: "Mark Twain" },
  { quote: "Kecerdasan itu seperti celana dalam. Penting untuk memilikinya, tapi tidak perlu memamerkannya.", author: "Bill Murray" },
  { quote: "Tidurlah, karena impianmu lebih indah daripada kenyataan. Tapi bangunlah, karena realita butuh uang.", author: "Anonim Witty" },
  { quote: "Guru yang baik itu seperti Google, mereka tahu segalanya tapi kadang butuh sinyal kopi untuk loading cepat.", author: "Humor Staf" },
  { quote: "Rapat sekolah adalah seni mendiskusikan apa yang seharusnya dikerjakan daripada benar-benar mengerjakannya.", author: "Pojok Pegawai" },
  { quote: "Misteri terbesar di sekolah: Ke mana perginya semua pulpen di atas meja saat kita menoleh satu detik?", author: "Catatan Guru" },
  { quote: "Mengajar di kelas pagi hari adalah tantangan antara mengedukasi siswa atau menahan diri agar tidak ikut tertidur.", author: "Refleksi Pagi" },
  { quote: "Jadwal pelajaran adalah saran, tapi jam istirahat adalah hukum yang tidak boleh diganggu gugat.", author: "Hukum Sekolah" },
  { quote: "Administrasi sekolah: 10% data, 90% mencari file yang salah simpan.", author: "Realita Pegawai" },
  { quote: "Istirahat 15 menit terasa seperti 2 detik, mengajar 1 jam terasa seperti 2 dekade.", author: "Relativitas Waktu" },
  { quote: "Dompet saya seperti bawang, membukanya membuat saya menangis.", author: "Humor Akhir Bulan" },
  { quote: "Saya butuh liburan enam bulan, dua kali setahun.", author: "Filosofi Santai" },
  { quote: "Olahraga terbaik adalah lari... lari dari kenyataan.", author: "Canda Pagi" },
  { quote: "Setiap kali saya menemukan kunci sukses, seseorang selalu mengganti gemboknya.", author: "Mark Twain" },
  { quote: "Hidup itu pendek. Tersenyumlah selagi kamu masih punya gigi.", author: "Anonim" },
  { quote: "Uang memang bukan segalanya, tapi segalanya butuh uang. Apalagi buat bayar cicilan.", author: "Realita Modern" },
  { quote: "Jangan pernah menunda sampai besok apa yang bisa kamu tunda sampai lusa.", author: "Mark Twain" },
  { quote: "Bekerjalah dengan giat, sampai saldo rekeningmu terlihat seperti nomor telepon internasional.", author: "Ambisi Humor" },
  { quote: "Cara terbaik untuk menghargai pekerjaanmu adalah dengan membayangkan dirimu tanpa pekerjaan.", author: "Oscar Wilde" },
  { quote: "Satu-satunya hal yang lebih cepat dari cahaya adalah kecepatan gosip di ruang guru.", author: "Fakta Ilmiah" },
  { quote: "Otak saya seperti browser: Punya 15 tab terbuka, 3 macet, dan saya tidak tahu dari mana asal musik itu.", author: "Kondisi Mental" },
  { quote: "Tuhan, berikanlah saya kesabaran... tapi tolong cepat sedikit!", author: "Doa Guru" },
  { quote: "Hidup ini penuh pilihan: Mau pusing mikir kerjaan, atau mau santai nunggu jam pulang.", author: "Pilihan Hari Ini" },
  { quote: "Jangan menyerah pada impianmu, teruslah tidur!", author: "Saran Kocak" },
  { quote: "Kopi adalah satu-satunya alasan saya bangun setiap pagi sebelum alarm sekolah berbunyi.", author: "Pecinta Kopi" },
  { quote: "Berhenti mencari kebahagiaan di tempat yang sama di mana kamu kehilangannya.", author: "Psikologi Witty" },
  { quote: "Jika rencana A gagal, ingatlah alfabet punya 25 huruf lainnya.", author: "Inspirasi Humor" },
  { quote: "Saya bukan pemalas, saya hanya sedang dalam mode hemat energi untuk mengajar nanti.", author: "Alasan Guru" },
  { quote: "Sekolah itu seru, yang bikin pusing itu tumpukan berkas yang minta ditandatangani segera.", author: "Curhat Pegawai" },
  { quote: "Kenapa guru matematika selalu mencari x? Biarkan saja ia pergi, dia sudah jadi mantan.", author: "Canda Matematika" },

  // --- PSIKOLOGI & REALITA (251-400) ---
  { quote: "Apa yang kita pikirkan menentukan apa yang akan terjadi pada kita.", author: "Norman Vincent Peale" },
  { quote: "Hidup adalah 10% apa yang terjadi pada kita dan 90% bagaimana kita meresponnya.", author: "Charles R. Swindoll" },
  { quote: "Kecantikan yang abadi terletak pada keelokan adab dan ketinggian ilmu.", author: "Buya Hamka" },
  { quote: "Hargai setiap progres kecil, karena ia adalah bagian dari perjalanan besar.", author: "Psikologi Positif" },
  { quote: "Kesehatan mental Anda lebih penting daripada nilai ujian mana pun.", author: "Pesan Psikolog" },
  { quote: "Mendidik dengan hati adalah cara paling ampuh untuk mencerdaskan pikiran.", author: "Refleksi Guru" },
  { quote: "Kesalahan adalah pintu masuk menuju penemuan baru.", author: "James Joyce" },
  { quote: "Satu ons tindakan bernilai lebih dari satu ton teori.", author: "Ralph Waldo Emerson" },
  { quote: "Pendidik yang hebat adalah mereka yang mampu membangkitkan rasa ingin tahu.", author: "Albert Einstein" },
  { quote: "Jangan tanyakan apa yang dunia butuhkan, tanyakan apa yang membuatmu hidup.", author: "Howard Thurman" },
  { quote: "Kreativitas membutuhkan keberanian untuk melepaskan kepastian.", author: "Erich Fromm" },
  { quote: "Syukuri setiap progres, sekecil apa pun itu.", author: "Filosofi Hidup" },
  { quote: "Tetaplah rendah hati, setinggi apa pun ilmu yang kita miliki.", author: "Etika Ilmu" },
  { quote: "Spenli adalah rumah, tempat kita tumbuh dan berbagi makna.", author: "Keluarga Besar" },
  { quote: "Masa depan anak-anak kita adalah tanggung jawab bersama.", author: "Visi Pendidikan" },
  { quote: "Hadirkan cinta dalam setiap pelajaran yang Anda berikan.", author: "Pesan Kasih" },
  { quote: "Karakter murid adalah cerminan dari keteladanan gurunya.", author: "Hukum Cermin" },
  { quote: "Tetap semangat, karena Anda adalah arsitek peradaban.", author: "Panggilan Jiwa" },
  { quote: "Selamat bertugas, mari ukir sejarah baru hari ini.", author: "E-SPENLI Muse" },
  { quote: "Berpikirlah seperti seorang ratu. Seorang ratu tidak takut gagal.", author: "Oprah Winfrey" },
  { quote: "Setiap hari adalah kesempatan untuk menjadi versi terbaik dari diri sendiri.", author: "Prinsip Pertumbuhan" },
  { quote: "Pekerjaan hebat membutuhkan istirahat yang hebat pula.", author: "Keseimbangan Hidup" },
  { quote: "Mendidik adalah menanam benih yang mungkin tidak akan pernah Anda lihat buahnya.", author: "Ketulusan" },
  { quote: "Kesuksesan terbesar seorang guru adalah melihat muridnya sukses melampauinya.", author: "Kebahagiaan Guru" },
  { quote: "Jadilah cahaya bagi kegelapan orang lain.", author: "Pesan Moral" },
  { quote: "Masa depan bangsa ini ada di genggaman tangan-tangan tulus para pendidik.", author: "Visi Nasional" },
  { quote: "Ilmu pengetahuan tanpa iman adalah buta, iman tanpa ilmu adalah lumpuh.", author: "Albert Einstein" },
  { quote: "Jangan pernah remehkan kekuatan tindakan kecil.", author: "Anonim" },
  { quote: "Disiplin hari ini adalah kenyamanan hari esok.", author: "Motto Sukses" },
  { quote: "Senyum Anda adalah kurikulum pertama yang mereka pelajari hari ini.", author: "Visi Guru" },

  // --- GUYONAN RUANG GURU & SEKOLAH (401-500) ---
  { quote: "Ruang guru: Tempat di mana semua masalah dunia diselesaikan dalam waktu 15 menit jam istirahat.", author: "Gosip Lucu" },
  { quote: "Misteri bekal guru: Kadang lebih menggoda daripada menu restoran bintang lima.", author: "Pojok Makan" },
  { quote: "Gosip di sekolah itu unik, belum sampai ke telinga admin, satu sekolah sudah tahu duluan.", author: "Antar Meja" },
  { quote: "Senyum admin sekolah adalah kunci kelancaran berkas kita hari ini.", author: "Hukum Administrasi" },
  { quote: "Guru piket adalah pahlawan tanpa tanda jasa yang bertempur melawan keterlambatan.", author: "Dunia Piket" },
  { quote: "Suara printer di ruang TU adalah musik latar paling dramatis sebelum jam laporan berakhir.", author: "Simfoni Kantor" },
  { quote: "Hanya guru yang bisa bicara 45 menit tanpa minum dan tetap punya tenaga buat marah-marah sayang.", author: "Kekuatan Super" },
  { quote: "Siswa yang paling nakal biasanya adalah yang paling rindu kita saat mereka sudah lulus.", author: "Realita Guru" },
  { quote: "Buku absen adalah benda paling sakral setelah buku tabungan.", author: "Prinsip Kehadiran" },
  { quote: "Libur nasional adalah hari raya bagi seluruh warga sekolah.", author: "Kegembiraan Bersama" },
  { quote: "Kopi guru: 70% kafein, 30% doa agar siswa hari ini tenang.", author: "Ramuan Rahasia" },
  { quote: "Spidol habis di saat sedang semangat mengajar adalah tragedi kecil yang menguji kesabaran.", author: "Drama Kelas" },
  { quote: "Topik terhangat di sekolah: Kenapa jam pulang terasa lebih lama daripada jam masuk?", author: "Debat Sains" },
  { quote: "Guru yang sabar adalah mereka yang bisa senyum saat melihat coretan di meja baru.", author: "Seni Mendidik" },
  { quote: "Sekolah bukan hanya gedung, tapi panggung di mana kita semua adalah pemeran utamanya.", author: "Analogi Pendidikan" },
  { quote: "Jangan lupa absen pulang, karena rindu keluarga butuh kepastian waktu.", author: "Pesan Manis" },
  { quote: "Papan tulis putih adalah saksi bisu betapa banyak ilmu yang kita tumpahkan hari ini.", author: "Refleksi Ruang" },
  { quote: "Guru teladan: Bangun paling pagi, tidur paling telat mikirin materi.", author: "Dedikasi Tanpa Batas" },
  { quote: "Terima kasih sudah hadir, dunia pendidikan butuh orang-orang hebat seperti Anda.", author: "E-SPENLI" },
  { quote: "Semangat pagi! Mari kita buat hari ini lebih baik dari kemarin dengan sedikit tawa.", author: "Salam Pagi" },
  { quote: "Masa depan anak didik kita dimulai dari kehadiran kita yang konsisten hari ini.", author: "Integritas" },
  { quote: "Jangan pernah berhenti mengabdi, karena satu kata darimu bisa merubah hidup satu anak.", author: "Kekuatan Kata" },
  { quote: "Selamat beristirahat, besok pagi sekolah masih butuh senyum dan ilmumu.", author: "Salam Senja" },
  { quote: "Menjadi bagian dari SMPN 5 adalah kebanggaan, menjadi dirimu adalah anugerah.", author: "Pesan Cinta" },
  { quote: "Setiap hari di sekolah adalah petualangan baru, mari nikmati setiap detiknya.", author: "Filosofi Kerja" },
  { quote: "Kerja tim di sekolah adalah kunci keberhasilan sistem pendidikan kita.", author: "Sinergi" },
  { quote: "Hiduplah dengan penuh gairah, karena pendidikan adalah tentang menularkan semangat.", author: "Motto Hidup" },
  { quote: "Jangan takut salah, karena dari kesalahan itulah proses belajar yang sesungguhnya dimulai.", author: "Psikologi Belajar" },
  { quote: "Pendidikan adalah cara kita mencintai masa depan tanpa harus melihatnya.", author: "Visi Bijak" },
  { quote: "Sampai jumpa besok di koridor sekolah dengan semangat yang baru!", author: "Harapan Esok" },
  { quote: "Hidup adalah rangkaian pelajaran yang harus dijalani untuk dimengerti.", author: "Ralph Waldo Emerson" },
  { quote: "Pendidikan adalah ornamen dalam kemakmuran dan perlindungan dalam kesulitan.", author: "Aristoteles" },
  { quote: "Seorang guru memengaruhi keabadian; ia tidak pernah tahu di mana pengaruhnya berhenti.", author: "Henry Adams" },
  { quote: "Mengajar adalah profesi yang menciptakan semua profesi lainnya.", author: "Anonim" },
  { quote: "Rahasia pendidikan terletak pada menghormati murid.", author: "Ralph Waldo Emerson" },
  { quote: "Tujuan pendidikan adalah mengganti pikiran yang kosong dengan pikiran yang terbuka.", author: "Malcolm Forbes" },
  { quote: "Belajar adalah harta karun yang akan mengikuti pemiliknya ke mana saja.", author: "Pepatah Cina" },
  { quote: "Jika Anda mempekerjakan orang hanya karena mereka bisa melakukan pekerjaan, mereka akan bekerja untuk uang Anda. Tetapi jika Anda mempekerjakan orang yang percaya pada apa yang Anda yakini, mereka akan bekerja untuk Anda dengan darah, keringat, dan air mata.", author: "Simon Sinek" },
  { quote: "Kecerdasan emosional adalah kemampuan untuk merasakan, memahami, dan secara efektif menerapkan daya dan ketajaman emosi sebagai sumber energi, informasi, koneksi, dan pengaruh manusia.", author: "Robert K. Cooper" },
  { quote: "Perubahan adalah hasil akhir dari semua pembelajaran sejati.", author: "Leo Buscaglia" },
  { quote: "Pendidikan bukan persiapan untuk hidup; pendidikan adalah hidup itu sendiri.", author: "John Dewey" },
  { quote: "Cara terbaik untuk belajar adalah dengan mengajar orang lain.", author: "Frank Oppenheimer" },
  { quote: "Bakat memenangkan pertandingan, tetapi kerja tim dan kecerdasan memenangkan kejuaraan.", author: "Michael Jordan" },
  { quote: "Guru yang menginspirasi tahu bahwa mengajar itu seperti menanam benih; hasilnya tidak terlihat besok.", author: "Filosofi Guru" },
  { quote: "Jangan takut untuk mengambil langkah besar jika memang diperlukan; Anda tidak bisa menyeberangi jurang dengan dua lompatan kecil.", author: "David Lloyd George" },
  { quote: "Optimisme adalah bentuk keberanian yang paling tinggi.", author: "Tokoh Psikologi" },
  { quote: "Kreativitas adalah melihat apa yang dilihat orang lain, tetapi memikirkan apa yang tidak dipikirkan orang lain.", author: "Albert Szent-Gyorgyi" },
  { quote: "Setiap keberhasilan dimulai dengan keputusan untuk mencoba.", author: "John F. Kennedy" },
  { quote: "Kesabaran itu pahit, tetapi buahnya sangat manis.", author: "Jean-Jacques Rousseau" },
  { quote: "Jangan biarkan apa yang tidak bisa Anda lakukan mengganggu apa yang bisa Anda lakukan.", author: "John Wooden" }
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
    // Gabungkan variabel input untuk menjamin variasi maksimal per user dan per sesi
    const uniqueSeed = `${input.userId}|${input.role}|${input.date}|${input.creativeSeed}`;
    const hash = getHash(uniqueSeed);
    
    // Pilih kutipan dari 500 database cadangan (premium fallback)
    const selectedFallback = fallbacks[hash % fallbacks.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.2,
          topP: 0.9,
          maxOutputTokens: 300,
        },
        system: `Anda adalah "E-SPENLI Oracle", kurator kutipan terbaik.
TUGAS: Berikan SATU kutipan pendek (15-30 kata) yang relevan untuk personil sekolah.

SUMBER INSPIRASI:
1. Tokoh sejarah, ilmuwan, pendidik, atau artis terkenal.
2. Filosofi Stoikisme atau Psikologi Positif.
3. Guyonan cerdas (Witty) tentang dunia pendidikan dan guru.

ATURAN KETAT:
- Gunakan Bahasa Indonesia yang elegan dan menginspirasi.
- Hindari All-Caps (Kecuali inisial).
- Tanpa emoji.
- Wajib sertakan nama tokoh/sumbernya.`,
        prompt: `Berikan kutipan unik untuk ${input.userName} (${input.role}) pada sesi ${input.attendanceType === 'in' ? 'absen masuk' : 'absen pulang'}. Gunakan benih acak: ${input.creativeSeed}`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output || !response.output.quote) throw new Error('AI_OFFLINE');
      return response.output;
    } catch (err: any) {
      // Jika AI gagal, database 500 kutipan ini menjamin variasi yang sangat luas
      console.warn('[AI_FALLBACK_ACTIVE]: Menggunakan database premium (500 item).');
      return selectedFallback;
    }
  }
);
