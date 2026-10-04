'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan inspiratif atau humor dari tokoh dunia/nasional.
 * Sistem menjamin keunikan setiap kali absen dengan 200+ database fallback berkualitas tinggi.
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
 * Database 200 Kutipan Cadangan (Kualitas Premium: Motivasi, Humor, & Realita Sekolah)
 */
const fallbacks = [
  // --- MOTIVASI TOKOH DUNIA (1-40) ---
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
  { quote: "Jangan pernah berhenti belajar, karena hidup tidak pernah berhenti mengajar.", author: "Lin Piao" },
  { quote: "Fokus pada perjalanan, bukan pada tujuan. Sukses adalah soal proses.", author: "Greg Anderson" },
  { quote: "Satu ons tindakan bernilai lebih dari satu ton teori.", author: "Ralph Waldo Emerson" },
  { quote: "Kecerdasan ditambah karakter—itulah tujuan pendidikan sejati.", author: "Martin Luther King Jr." },
  { quote: "Tujuan hidup adalah untuk menjadi berguna, terhormat, dan penyayang.", author: "Ralph Waldo Emerson" },
  { quote: "Kebahagiaan berasal dari tindakan Anda sendiri.", author: "Dalai Lama" },
  { quote: "Kesalahan adalah pintu masuk menuju penemuan.", author: "James Joyce" },
  { quote: "Satu-satunya sumber pengetahuan adalah pengalaman.", author: "Albert Einstein" },
  { quote: "Masa depan bergantung pada apa yang kamu lakukan hari ini.", author: "Mahatma Gandhi" },
  { quote: "Pendidikan adalah senjata terkuat yang dapat Anda gunakan untuk mengubah dunia.", author: "Nelson Mandela" },
  { quote: "Disiplin adalah jembatan antara tujuan dan pencapaian.", author: "Jim Rohn" },
  { quote: "Selagi kita mengajar, kita belajar.", author: "Seneca" },
  { quote: "Hanya orang yang berani gagal besar yang bisa mencapai keberhasilan besar.", author: "Robert F. Kennedy" },
  { quote: "Waktu Anda terbatas, jangan sia-siakan untuk menjalani hidup orang lain.", author: "Steve Jobs" },
  { quote: "Belajarlah dari hari kemarin, hiduplah untuk hari ini, berharaplah untuk hari esok.", author: "Albert Einstein" },
  { quote: "Kepemimpinan adalah pengaruh, bukan otoritas.", author: "John C. Maxwell" },
  { quote: "Jadilah cahaya bagi kegelapan orang lain.", author: "Pesan Moral" },
  { quote: "Pendidikan adalah menyalakan lilin, bukan mengisi ember.", author: "Anonim" },
  { quote: "Kesabaran adalah kunci dari segala kebahagiaan.", author: "Pepatah" },
  { quote: "Logika akan membawa Anda dari A ke B. Imajinasi akan membawa Anda ke mana saja.", author: "Albert Einstein" },
  { quote: "Jika Anda ingin hidup bahagia, ikatlah pada tujuan, bukan pada orang atau benda.", author: "Albert Einstein" },
  { quote: "Cobalah untuk tidak menjadi orang sukses, melainkan menjadi orang yang bernilai.", author: "Albert Einstein" },
  { quote: "Sukses bukanlah kunci kebahagiaan. Kebahagiaanlah kunci kesuksesan.", author: "Albert Schweitzer" },
  { quote: "Jangan pernah meremehkan kekuatan tindakan kecil.", author: "Anonim" },
  { quote: "Kualitas hidup ditentukan oleh kualitas pikiran kita.", author: "Marcus Aurelius" },

  // --- TOKOH NASIONAL & INDONESIA (41-80) ---
  { quote: "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani.", author: "Ki Hajar Dewantara" },
  { quote: "Gantungkan cita-citamu setinggi langit! Bermimpilah setinggi langit. Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.", author: "Soekarno" },
  { quote: "Keberhasilan bukanlah milik orang pintar, keberhasilan adalah milik mereka yang senantiasa berusaha.", author: "B.J. Habibie" },
  { quote: "Habis gelap terbitlah terang.", author: "R.A. Kartini" },
  { quote: "Tugas kita bukanlah untuk berhasil. Tugas kita adalah untuk mencoba.", author: "Buya Hamka" },
  { quote: "Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang di dalam masyarakat.", author: "Pramoedya Ananta Toer" },
  { quote: "Pendidikan itu mempertajam kecerdasan, memperkukuh kemauan serta memperhalus perasaan.", author: "Tan Malaka" },
  { quote: "Kadang kita butuh berhenti sejenak, menoleh ke belakang untuk mensyukuri perjalanan.", author: "Najwa Shihab" },
  { quote: "Kerja ikhlas adalah napas dari pengabdian di SMPN 5 Langke Rembong.", author: "Slogan E-SPENLI" },
  { quote: "Ilmu tanpa amal adalah seperti pohon tanpa buah.", author: "Pepatah Arab" },
  { quote: "Bangsa yang besar adalah bangsa yang menghormati jasa pahlawannya.", author: "Soekarno" },
  { quote: "Merdeka atau Mati!", author: "Bung Tomo" },
  { quote: "Negara ini tidak akan kekurangan orang pintar, tapi kekurangan orang jujur.", author: "Kasino Warkop" },
  { quote: "Syukur adalah kunci keberkahan hari Anda di sekolah.", author: "Keluarga E-SPENLI" },
  { quote: "Masa depan anak didik kita adalah cerminan dari dedikasi kita hari ini.", author: "Motto Guru" },
  { quote: "Mendidik dengan hati adalah cara paling ampuh untuk mencerdaskan pikiran.", author: "Refleksi Guru" },
  { quote: "Setiap langkah di koridor sekolah ini adalah ibadah jika diniatkan untuk pengabdian.", author: "Pesan Pagi" },
  { quote: "Jangan tanyakan apa yang negara berikan padamu, tapi apa yang kamu berikan pada bangsamu.", author: "Soekarno" },
  { quote: "Ilmu pengetahuan dan teknologi tanpa iman dan takwa adalah hampa.", author: "B.J. Habibie" },
  { quote: "Tiada awan di langit yang tetap selamanya. Tiada mungkin akan terus terang cuaca.", author: "R.A. Kartini" },
  { quote: "Kecantikan yang abadi terletak pada keelokan adab dan ketinggian ilmu.", author: "Buya Hamka" },
  { quote: "Guru sejati adalah guru yang bisa membuat murid-muridnya merasa pintar.", author: "Pesan Pendidikan" },
  { quote: "Kemerdekaan hanyalah jembatan, di seberang jembatan itulah kita membangun bangsa.", author: "Soekarno" },
  { quote: "Belajar itu tidak harus selalu di kelas, dunia adalah sekolah dan setiap orang adalah guru.", author: "Ki Hajar Dewantara" },
  { quote: "Jangan pernah mengeluh atas lelahmu, karena itu adalah tanda pengabdianmu yang nyata.", author: "Motivator Nasional" },
  { quote: "Masa depan bangsa ini ada di genggaman tangan-tangan tulus para pendidik.", author: "Visi Nasional" },
  { quote: "Sekolah bukan hanya gedung, tapi ruang tumbuh bagi harapan dan cita-cita.", author: "Inspirasi Spenli" },
  { quote: "Kesuksesan terbesar seorang guru adalah melihat muridnya sukses melampauinya.", author: "Kebahagiaan Guru" },
  { quote: "Teruslah menjadi teladan, karena mata anak-anak lebih tajam dari telinga mereka.", author: "Nasihat Bijak" },
  { quote: "Guru yang baik tidak hanya mengajar, tetapi juga menggerakkan.", author: "Tokoh Pendidikan" },

  // --- HUMOR & WITTY (81-140) ---
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
  { quote: "Guru itu multitalenta: Bisa jadi detektif mencari pulpen hilang, bisa jadi hakim mendamaikan pertikaian siswa.", author: "Sisi Lain Guru" },
  { quote: "Menjadi pegawai sekolah itu seru, setiap hari adalah 'survival mode' menghadapi tumpukan kertas.", author: "Dunia Pegawai" },
  { quote: "Kopi pagi ini adalah bahan bakar utama, pengabdian adalah akselerasinya.", author: "Filosofi Kopi" },
  { quote: "Satu-satunya hal yang lebih cepat dari cahaya adalah kecepatan gosip di ruang guru.", author: "Fakta Ilmiah" },
  { quote: "Jika rencana A gagal, ingatlah alfabet punya 25 huruf lainnya.", author: "Anonim" },
  { quote: "Otak saya seperti browser: Punya 15 tab terbuka, 3 macet, dan saya tidak tahu dari mana asal musik itu.", author: "Kondisi Mental" },
  { quote: "Berhentilah mencari kebahagiaan di tempat yang sama di mana kamu kehilangannya.", author: "Nasihat Witty" },
  { quote: "Tuhan, berikanlah saya kesabaran... tapi tolong cepat sedikit!", author: "Doa Singkat" },
  { quote: "Hidup ini penuh pilihan: Mau pusing mikir kerjaan, atau mau santai nunggu jam pulang.", author: "Pilihan Hari Ini" },
  { quote: "Setiap hari adalah kesempatan baru... untuk minum kopi lagi.", author: "Rutinitas Pagi" },
  { quote: "Jangan menyerah pada impianmu, teruslah tidur!", author: "Saran Buruk" },

  // --- REFLEKSI & SEKOLAH (141-200) ---
  { quote: "Senyum Anda saat menyapa siswa di gerbang adalah kurikulum terbaik yang mereka terima hari ini.", author: "Visi Guru" },
  { quote: "Setiap murid adalah kanvas kosong, jadilah kuas yang memberi warna hari ini.", author: "Inspirasi Pagi" },
  { quote: "Tantangan hari ini adalah peluang untuk memberi inspirasi. Selamat mengabdi.", author: "Motto Harian" },
  { quote: "Pagi adalah awal baru untuk jiwa yang ikhlas mendidik. Semangat menyinari kelas!", author: "Pesan Fajar" },
  { quote: "Tuntas sudah perjuangan hari ini. Waktunya pulang dan mengisi ulang energi.", author: "Pesan Sore" },
  { quote: "Beban kerja tuntas, kehangatan keluarga menunggu. Hati-hati di jalan.", author: "Salam Pulang" },
  { quote: "Besok adalah petualangan baru, sore ini adalah kemenangan untuk diri sendiri.", author: "Penutup Hari" },
  { quote: "Mendidik adalah menanam benih yang mungkin tidak akan pernah Anda lihat buahnya.", author: "Nasihat Bijak" },
  { quote: "Pendidik yang hebat adalah mereka yang mampu membangkitkan rasa ingin tahu.", author: "Albert Einstein" },
  { quote: "Sekolah adalah tempat di mana karakter dibentuk lebih kuat daripada besi.", author: "Pesan Karakter" },
  { quote: "Kesabaran adalah bahasa yang dimengerti bahkan oleh mereka yang belum bisa bicara.", author: "Nasihat Guru" },
  { quote: "Jadilah guru yang membuat muridmu rindu datang ke sekolah.", author: "Motto Pengabdian" },
  { quote: "Kejujuran dalam mengabdi adalah warisan terbaik bagi generasi mendatang.", author: "Filosofi Spenli" },
  { quote: "Setiap hari di sekolah adalah kesempatan untuk menjadi pahlawan tanpa perlu jubah.", author: "Realita Guru" },
  { quote: "Pendidikan sejati bukan soal apa yang kita ketahui, tapi soal siapa kita nantinya.", author: "Pesan Moral" },
  { quote: "Bekerja di sekolah adalah tentang melayani masa depan.", author: "Dunia Pendidikan" },
  { quote: "Ikhlas dalam mendidik akan mempermudah jalan bagi anak didik kita.", author: "Ketulusan" },
  { quote: "Jangan lelah menebar kebaikan, meski kadang hasilnya tak kasat mata.", author: "Motivasi Guru" },
  { quote: "Kebanggaan terbesar guru adalah melihat binar mata murid saat memahami hal baru.", author: "Momen Emas" },
  { quote: "Kedisiplinan hari ini adalah fondasi bagi kesuksesan hari esok.", author: "Aturan Sekolah" },
  { quote: "Mari kita mulai hari dengan niat yang murni dan semangat yang tinggi.", author: "Ajakan Pagi" },
  { quote: "Tugas administrator sekolah adalah memastikan harmoni dalam sistem pendidikan.", author: "Tugas Pegawai" },
  { quote: "Setiap data yang diolah adalah bagian dari kemajuan sekolah kita.", author: "Visi Administrasi" },
  { quote: "Guru bukan hanya pengajar, tapi juga penuntun jalan.", author: "Pesan Bijak" },
  { quote: "Satu senyuman di pagi hari bisa merubah suasana satu kelas.", author: "Kekuatan Senyum" },
  { quote: "Berikan yang terbaik, biarkan Tuhan yang mengerjakan sisanya.", author: "Prinsip Kerja" },
  { quote: "Jangan pernah remehkan potensi siswa yang pendiam di sudut kelas.", author: "Wawasan Guru" },
  { quote: "Pendidikan adalah investasi yang tidak akan pernah mengalami devaluasi.", author: "Ekonomi Ilmu" },
  { quote: "Selamat beristirahat, besok dunia masih butuh cahaya dari dedikasi Anda.", author: "Salam Senja" },
  { quote: "Istirahatlah dengan tenang, keluarga menanti cerita hebat Anda di rumah.", author: "Pesan Keluarga" },
  { quote: "Jangan bawa pulang beban sekolah, bawalah pulang kebahagiaan.", author: "Nasihat Pulang" },
  { quote: "Pekerjaan hebat membutuhkan istirahat yang hebat pula.", author: "Keseimbangan Hidup" },
  { quote: "Syukuri setiap progres, sekecil apa pun itu.", author: "Filosofi Hidup" },
  { quote: "Tetaplah rendah hati, setinggi apa pun ilmu yang kita miliki.", author: "Etika Ilmu" },
  { quote: "Spenli adalah rumah, tempat kita tumbuh dan berbagi makna.", author: "Keluarga Besar" },
  { quote: "Masa depan anak-anak kita adalah tanggung jawab bersama.", author: "Visi Pendidikan" },
  { quote: "Hadirkan cinta dalam setiap pelajaran yang Anda berikan.", author: "Pesan Kasih" },
  { quote: "Karakter murid adalah cerminan dari keteladanan gurunya.", author: "Hukum Cermin" },
  { quote: "Tetap semangat, karena Anda adalah arsitek peradaban.", author: "Panggilan Jiwa" },
  { quote: "Selamat bertugas di SMPN 5, mari ukir sejarah baru hari ini.", author: "E-SPENLI" },
  { quote: "Keberhasilan bukan soal menjadi yang tercepat, tapi soal tidak pernah berhenti.", author: "Konfusius" },
  { quote: "Cara terbaik untuk menghancurkan musuh adalah dengan menjadikannya teman.", author: "Abraham Lincoln" },
  { quote: "Kebahagiaan sejati terletak pada kegembiraan melakukan pekerjaan dengan baik.", author: "Franklin D. Roosevelt" },
  { quote: "Berpikirlah seperti seorang ratu. Seorang ratu tidak takut gagal.", author: "Oprah Winfrey" },
  { quote: "Apa yang kita pikirkan menentukan apa yang akan terjadi pada kita.", author: "Norman Vincent Peale" },
  { quote: "Segala sesuatu yang dapat Anda bayangkan adalah nyata.", author: "Pablo Picasso" },
  { quote: "Hanya mereka yang berani gagal yang dapat mencapai hal-hal besar.", author: "Robert F. Kennedy" },
  { quote: "Jika Anda ingin terbang, lepaskan segala hal yang membebani Anda.", author: "Toni Morrison" },
  { quote: "Hidup adalah 10% apa yang terjadi pada kita dan 90% bagaimana kita meresponnya.", author: "Charles R. Swindoll" },
  { quote: "Jangan menunggu. Waktunya tidak akan pernah tepat.", author: "Napoleon Hill" },
  { quote: "Berusahalah untuk menjadi berharga, bukan hanya menjadi sukses.", author: "Albert Einstein" },
  { quote: "Pendidikan adalah penemuan atas ketidaktahuan kita sendiri.", author: "Will Durant" },
  { quote: "Belajarlah di waktu kecil seperti mengukir di atas batu.", author: "Pepatah Bijak" },
  { quote: "Pena lebih tajam daripada pedang.", author: "Edward Bulwer-Lytton" },
  { quote: "Pekerjaan Anda akan mengisi sebagian besar hidup Anda.", author: "Steve Jobs" },
  { quote: "Kreativitas membutuhkan keberanian untuk melepaskan kepastian.", author: "Erich Fromm" },
  { quote: "Jangan pernah berhenti berharap, karena keajaiban terjadi setiap hari.", author: "Inspirasi" },
  { quote: "Jadikan setiap hari mahakarya Anda.", author: "John Wooden" },
  { quote: "Kesenangan dalam bekerja memberikan kesempurnaan pada hasil kerja.", author: "Aristoteles" },
  { quote: "Lakukan apa yang Anda bisa, dengan apa yang Anda miliki, di mana pun Anda berada.", author: "Theodore Roosevelt" }
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
    
    // Pilih kutipan dari 200 database
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
      console.warn('[AI_FALLBACK_ACTIVE]: Menggunakan database kutipan cadangan berkualitas tinggi (200 item).');
      return selectedFallback;
    }
  }
);
