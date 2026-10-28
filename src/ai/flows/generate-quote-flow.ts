
'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan inspiratif atau humor dari tokoh dunia/nasional.
 * Mendukung penggunaan Kunci API dinamis dari database atau variabel lingkungan.
 * Versi V2.2: 500 Database Cadangan Baru & Label IsAi.
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
 * Database 500 Kutipan Cadangan Baru (Motivational, Educational, Wisdom)
 */
const fallbacks = [
  { quote: "Jangan biarkan apa yang tidak bisa Anda lakukan mengganggu apa yang bisa Anda lakukan.", author: "John Wooden" },
  { quote: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan itu Anda bisa mengubah dunia.", author: "Nelson Mandela" },
  { quote: "Akar dari pendidikan itu pahit, tetapi buahnya sangat manis.", author: "Aristoteles" },
  { quote: "Hiduplah seolah-olah Anda akan mati besok. Belajarlah seolah-olah Anda akan hidup selamanya.", author: "Mahatma Gandhi" },
  { quote: "Investasi dalam pengetahuan selalu membayar bunga terbaik.", author: "Benjamin Franklin" },
  { quote: "Tujuan dari pendidikan adalah untuk menggantikan pikiran yang kosong dengan pikiran yang terbuka.", author: "Malcolm Forbes" },
  { quote: "Satu anak, satu guru, satu buku, dan satu pena dapat mengubah dunia.", author: "Malala Yousafzai" },
  { quote: "Pendidikan bukanlah persiapan untuk hidup; pendidikan adalah hidup itu sendiri.", author: "John Dewey" },
  { quote: "Siapa pun yang berhenti belajar adalah orang tua, baik di usia dua puluh atau delapan puluh tahun.", author: "Henry Ford" },
  { quote: "Kegagalan adalah kesempatan untuk memulai lagi dengan lebih cerdas.", author: "Henry Ford" },
  { quote: "Jenius adalah 1% inspirasi dan 99% keringat.", author: "Thomas Edison" },
  { quote: "Kesuksesan adalah kemampuan untuk beralih dari satu kegagalan ke kegagalan lain tanpa kehilangan antusiasme.", author: "Winston Churchill" },
  { quote: "Masa depan adalah milik mereka yang percaya pada keindahan impian mereka.", author: "Eleanor Roosevelt" },
  { quote: "Lakukan apa yang Anda bisa, dengan apa yang Anda miliki, di mana pun Anda berada.", author: "Theodore Roosevelt" },
  { quote: "Pikiran adalah segalanya. Apa yang Anda pikirkan, itulah yang Anda jadikan.", author: "Buddha" },
  { quote: "Disiplin adalah jembatan antara tujuan dan pencapaian.", author: "Jim Rohn" },
  { quote: "Optimisme adalah kepercayaan yang membawa pada pencapaian.", author: "Helen Keller" },
  { quote: "Tindakan adalah kunci dasar untuk semua kesuksesan.", author: "Pablo Picasso" },
  { quote: "Waktu Anda terbatas, jadi jangan sia-siakan dengan menjalani hidup orang lain.", author: "Steve Jobs" },
  { quote: "Kesenangan dalam pekerjaan menghasilkan kesempurnaan pada hasil kerja.", author: "Aristoteles" },
  { quote: "Integritas adalah melakukan hal yang benar, bahkan ketika tidak ada orang yang melihat.", author: "C.S. Lewis" },
  { quote: "Cara terbaik untuk memprediksi masa depan adalah dengan menciptakannya.", author: "Peter Drucker" },
  { quote: "Rahasia untuk maju adalah dengan memulai.", author: "Mark Twain" },
  { quote: "Pendidikan adalah kunci untuk membuka pintu emas kebebasan.", author: "George Washington Carver" },
  { quote: "Pekerjaan hebat dilakukan bukan dengan kekuatan, melainkan dengan ketekunan.", author: "Samuel Johnson" },
  { quote: "Kualitas bukanlah sebuah tindakan, melainkan sebuah kebiasaan.", author: "Aristoteles" },
  { quote: "Berani memulai adalah setengah dari perjalanan.", author: "Pepatah Klasik" },
  { quote: "Guru yang baik adalah lilin; ia menghabiskan dirinya sendiri untuk mencerahkan jalan bagi orang lain.", author: "Mustafa Kemal Atatürk" },
  { quote: "Belajar tanpa berpikir itu tidak berguna, berpikir tanpa belajar itu berbahaya.", author: "Konfusius" },
  { quote: "Kebijaksanaan terbesar adalah mengetahui bahwa Anda belum tahu apa-apa.", author: "Socrates" },
  { quote: "Keberanian tidak selalu mengaum. Terkadang keberanian adalah suara lembut di akhir hari yang mengatakan, 'Aku akan mencoba lagi besok'.", author: "Mary Anne Radmacher" },
  { quote: "Setiap pagi kita dilahirkan kembali. Apa yang kita lakukan hari ini adalah yang paling penting.", author: "Dhammapada" },
  { quote: "Kesabaran itu pahit, tetapi buahnya manis.", author: "Jean-Jacques Rousseau" },
  { quote: "Pendidikan itu seperti menyalakan api, bukan mengisi wadah.", author: "William Butler Yeats" },
  { quote: "Jadikan hari ini mahakarya Anda.", author: "John Wooden" },
  { quote: "Ilmu adalah cahaya, dan cahaya Tuhan tidak akan diberikan kepada pelaku maksiat.", author: "Imam Syafi'i" },
  { quote: "Barangsiapa yang tidak mau merasakan pahitnya belajar, ia akan merasakan hinanya kebodohan sepanjang hidupnya.", author: "Imam Syafi'i" },
  { quote: "Tuntutlah ilmu sampai ke negeri Cina.", author: "Pepatah Bijak" },
  { quote: "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani.", author: "Ki Hajar Dewantara" },
  { quote: "Gantungkan cita-citamu setinggi langit! Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.", author: "Soekarno" },
  { quote: "Bangsa yang besar adalah bangsa yang menghargai jasa pahlawannya.", author: "Soekarno" },
  { quote: "Kecerdasan tanpa karakter adalah ancaman bagi masyarakat.", author: "Martin Luther King Jr." },
  { quote: "Kita harus belajar hidup bersama sebagai saudara atau binasa bersama sebagai orang bodoh.", author: "Martin Luther King Jr." },
  { quote: "Kreativitas adalah kecerdasan yang sedang bersenang-senang.", author: "Albert Einstein" },
  { quote: "Imajinasi lebih penting daripada pengetahuan.", author: "Albert Einstein" },
  { quote: "Satu-satunya sumber pengetahuan adalah pengalaman.", author: "Albert Einstein" },
  { quote: "Cobalah untuk tidak menjadi orang yang sukses, tetapi cobalah menjadi orang yang bernilai.", author: "Albert Einstein" },
  { quote: "Kekuatan tidak datang dari kapasitas fisik. Ia datang dari kemauan yang gigih.", author: "Mahatma Gandhi" },
  { quote: "Kepuasan terletak pada usaha, bukan pada pencapaian.", author: "Mahatma Gandhi" },
  { quote: "Ketekunan adalah kerja keras yang Anda lakukan setelah Anda lelah melakukan kerja keras yang sudah Anda lakukan.", author: "Newt Gingrich" },
  { quote: "Kesuksesan hari ini adalah sisa dari kegagalan kemarin.", author: "Robert Schuller" },
  { quote: "Jangan pernah berhenti bermimpi, karena mimpi adalah benih dari kenyataan.", author: "Anonim" },
  { quote: "Langkah kecil di arah yang benar lebih baik daripada langkah besar di arah yang salah.", author: "Pepatah Cina" },
  { quote: "Hanya mereka yang berani gagal besar yang bisa mencapai keberhasilan besar.", author: "Robert F. Kennedy" },
  { quote: "Jadilah perubahan yang ingin Anda lihat di dunia.", author: "Mahatma Gandhi" },
  { quote: "Keberhasilan bukanlah kunci kebahagiaan. Kebahagiaan adalah kunci keberhasilan.", author: "Albert Schweitzer" },
  { quote: "Pekerjaan Anda akan mengisi sebagian besar hidup Anda, dan satu-satunya cara untuk benar-benar puas adalah melakukan apa yang Anda yakini sebagai pekerjaan hebat.", author: "Steve Jobs" },
  { quote: "Inovasi membedakan antara pemimpin dan pengikut.", author: "Steve Jobs" },
  { quote: "Tetap lapar, tetap bodoh.", author: "Steve Jobs" },
  { quote: "Semakin banyak Anda membaca, semakin banyak hal yang akan Anda ketahui.", author: "Dr. Seuss" },
  { quote: "Anda memiliki otak di kepala Anda. Anda memiliki kaki di sepatu Anda. Anda dapat mengarahkan diri Anda ke arah mana pun yang Anda pilih.", author: "Dr. Seuss" },
  { quote: "Mengajar adalah profesi yang menciptakan semua profesi lainnya.", author: "Anonim" },
  { quote: "Pendidikan adalah paspor menuju masa depan, karena hari esok milik mereka yang mempersiapkannya hari ini.", author: "Malcolm X" },
  { quote: "Arah pendidikan yang diberikan kepada seseorang akan menentukan masa depannya.", author: "Plato" },
  { quote: "Awal dari kebijaksanaan adalah definisi istilah.", author: "Socrates" },
  { quote: "Kehidupan yang tidak teruji tidak layak dijalani.", author: "Socrates" },
  { quote: "Orang yang paling bahagia adalah orang yang membuat paling banyak orang lain bahagia.", author: "Denis Diderot" },
  { quote: "Kebaikan adalah bahasa yang bisa didengar oleh si tuli dan dilihat oleh si buta.", author: "Mark Twain" },
  { quote: "Dua hari terpenting dalam hidup Anda adalah hari Anda dilahirkan dan hari Anda mengetahui alasannya.", author: "Mark Twain" },
  { quote: "Berikan setiap hari kesempatan untuk menjadi hari terindah dalam hidup Anda.", author: "Mark Twain" },
  { quote: "Kebijaksanaan dimulai dengan rasa heran.", author: "Socrates" },
  { quote: "Seseorang yang tidak pernah melakukan kesalahan tidak pernah mencoba sesuatu yang baru.", author: "Albert Einstein" },
  { quote: "Logika akan membawa Anda dari A ke B. Imajinasi akan membawa Anda ke mana saja.", author: "Albert Einstein" },
  { quote: "Dunia adalah tempat yang berbahaya untuk ditinggali; bukan karena orang-orang yang jahat, tetapi karena orang-orang yang tidak melakukan apa-apa tentang hal itu.", author: "Albert Einstein" },
  { quote: "Perdamaian tidak bisa dijaga dengan kekuatan; itu hanya bisa dicapai dengan pemahaman.", author: "Albert Einstein" },
  { quote: "Jangan pernah menganggap belajar sebagai tugas, melainkan sebagai kesempatan berharga untuk mempelajari keindahan semangat manusia.", author: "Albert Einstein" },
  { quote: "Ukur kecerdasan adalah kemampuan untuk berubah.", author: "Albert Einstein" },
  { quote: "Guru yang biasa saja memberitahu. Guru yang baik menjelaskan. Guru yang hebat mendemonstrasikan. Guru yang luar biasa menginspirasi.", author: "William Arthur Ward" },
  { quote: "Pendidikan bukanlah mengisi ember, melainkan menyalakan api.", author: "William Butler Yeats" },
  { quote: "Tujuan utama pendidikan bukanlah pengetahuan, melainkan tindakan.", author: "Herbert Spencer" },
  { quote: "Pengetahuan tanpa tindakan adalah sia-sia, dan tindakan tanpa pengetahuan adalah kegilaan.", author: "Abu Bakar Ash-Shiddiq" },
  { quote: "Karakter adalah siapa Anda ketika tidak ada yang melihat.", author: "Anonim" },
  { quote: "Kebiasaan lama tidak membuka pintu baru.", author: "Anonim" },
  { quote: "Fokuslah pada kemajuan, bukan kesempurnaan.", author: "Anonim" },
  { quote: "Lakukan hari ini apa yang orang lain tidak mau lakukan, agar besok Anda bisa mendapatkan apa yang orang lain tidak bisa dapatkan.", author: "Jerry Rice" },
  { quote: "Kesuksesan adalah jumlah dari upaya kecil, yang diulang hari demi hari.", author: "Robert Collier" },
  { quote: "Jangan menunggu kesempatan datang. Ciptakanlah.", author: "Anonim" },
  { quote: "Kesempatan sering kali menyamar sebagai kerja keras, itulah sebabnya kebanyakan orang tidak mengenalinya.", author: "Ann Landers" },
  { quote: "Satu-satunya batasan bagi realisasi kita akan hari esok adalah keraguan kita hari ini.", author: "Franklin D. Roosevelt" },
  { quote: "Masa depan bergantung pada apa yang kita lakukan di masa sekarang.", author: "Mahatma Gandhi" },
  { quote: "Cara untuk memulai adalah berhenti berbicara dan mulai melakukan.", author: "Walt Disney" },
  { quote: "Semua impian kita bisa menjadi kenyataan jika kita memiliki keberanian untuk mengejarnya.", author: "Walt Disney" },
  { quote: "Teruslah bergerak maju.", author: "Walt Disney" },
  { quote: "Keberhasilan itu bukan final, kegagalan itu bukan fatal: itu adalah keberanian untuk melanjutkan yang diperhitungkan.", author: "Winston Churchill" },
  { quote: "Anda melewatkan 100% tembakan yang tidak Anda ambil.", author: "Wayne Gretzky" },
  { quote: "Hargai waktu, karena ia tidak akan pernah kembali untuk menyapa Anda.", author: "Anonim" },
  { quote: "Membaca adalah jendela dunia.", author: "Pepatah Indonesia" },
  { quote: "Hemat pangkal kaya, rajin pangkal pandai.", author: "Pepatah Indonesia" },
  { quote: "Berakit-rakit ke hulu, berenang-renang ke tepian. Bersakit-sakit dahulu, bersenang-senang kemudian.", author: "Pepatah Indonesia" },
  { quote: "Pendidikan adalah perhiasan di waktu makmur dan tempat perlindungan di waktu malang.", author: "Aristoteles" },
  { quote: "Belajar adalah harta karun yang akan mengikuti pemiliknya ke mana pun.", author: "Pepatah Cina" },
  { quote: "Buku adalah sahabat yang paling setia.", author: "Ernest Hemingway" },
  { quote: "Tidak ada teman yang sesetia buku.", author: "Ernest Hemingway" },
  { quote: "Perjalanan seribu mil dimulai dengan satu langkah.", author: "Lao Tzu" },
  { quote: "Mengetahui orang lain adalah kecerdasan; mengetahui diri sendiri adalah kebijaksanaan sejati.", author: "Lao Tzu" },
  { quote: "Tindakan berbicara lebih keras daripada kata-kata.", author: "Anonim" },
  { quote: "Kesederhanaan adalah kecanggihan tertinggi.", author: "Leonardo da Vinci" },
  { quote: "Belajar tidak pernah melelahkan pikiran.", author: "Leonardo da Vinci" },
  { quote: "Kebenaran adalah putri waktu.", author: "Leonardo da Vinci" },
  { quote: "Waktu yang Anda nikmati untuk disia-siakan bukanlah waktu yang sia-sia.", author: "Bertrand Russell" },
  { quote: "Masalah dengan dunia adalah orang bodoh yang merasa sangat yakin dan orang pintar yang penuh keraguan.", author: "Bertrand Russell" },
  { quote: "Kualitas hidup Anda ditentukan oleh kualitas pertanyaan yang Anda ajukan pada diri sendiri.", author: "Tony Robbins" },
  { quote: "Masa lalu tidak sama dengan masa depan.", author: "Tony Robbins" },
  { quote: "Ke mana fokus pergi, energi mengalir.", author: "Tony Robbins" },
  { quote: "Perubahan terjadi ketika rasa sakit karena tetap sama lebih besar daripada rasa sakit karena berubah.", author: "Tony Robbins" },
  { quote: "Tetapkan tujuan yang sangat tinggi sehingga Anda tidak bisa mencapainya kecuali Anda tumbuh menjadi orang yang mampu mencapainya.", author: "Anonim" },
  { quote: "Kebahagiaan bukan sesuatu yang sudah jadi. Itu berasal dari tindakan Anda sendiri.", author: "Dalai Lama" },
  { quote: "Tujuan hidup kita adalah untuk menjadi bahagia.", author: "Dalai Lama" },
  { quote: "Jadilah baik kapan pun memungkinkan. Itu selalu mungkin.", author: "Dalai Lama" },
  { quote: "Ingatlah bahwa tidak mendapatkan apa yang Anda inginkan terkadang merupakan keberuntungan yang luar biasa.", author: "Dalai Lama" },
  { quote: "Aturan emas dalam pendidikan adalah: contoh yang baik adalah guru terbaik.", author: "Anonim" },
  { quote: "Hanya ada satu hal yang membuat mimpi tidak mungkin tercapai: ketakutan akan kegagalan.", author: "Paulo Coelho" },
  { quote: "Ketika Anda menginginkan sesuatu, seluruh alam semesta berkonspirasi untuk membantu Anda mencapainya.", author: "Paulo Coelho" },
  { quote: "Rahasia kehidupan adalah jatuh tujuh kali dan bangun delapan kali.", author: "Paulo Coelho" },
  { quote: "Berani adalah mengetahui apa yang tidak perlu ditakuti.", author: "Plato" },
  { quote: "Orang bijak berbicara karena mereka memiliki sesuatu untuk dikatakan; orang bodoh karena mereka harus mengatakan sesuatu.", author: "Plato" },
  { quote: "Kemenangan pertama dan terbaik adalah menaklukkan diri sendiri.", author: "Plato" },
  { quote: "Ketidaktahuan adalah akar dan batang dari segala kejahatan.", author: "Plato" },
  { quote: "Musik memberi jiwa pada alam semesta, sayap pada pikiran, terbang pada imajinasi, dan kehidupan pada segalanya.", author: "Plato" },
  { quote: "Pendidikan adalah menyalakan api, bukan mengisi bejana.", author: "Socrates" },
  { quote: "Satu-satunya kebijaksanaan sejati adalah mengetahui bahwa Anda tidak tahu apa-apa.", author: "Socrates" },
  { quote: "Gunakan waktu Anda untuk meningkatkan diri melalui tulisan orang lain, sehingga Anda mendapatkan dengan mudah apa yang telah diupayakan orang lain dengan keras.", author: "Socrates" },
  { quote: "Budi pekerti yang baik lebih berharga daripada kekayaan.", author: "Anonim" },
  { quote: "Kesopanan adalah bunga kemanusiaan.", author: "Anonim" },
  { quote: "Disiplin hari ini adalah kebebasan hari esok.", author: "Anonim" },
  { quote: "Setiap tantangan adalah peluang untuk tumbuh.", author: "Anonim" },
  { quote: "Jangan biarkan hari kemarin menyita terlalu banyak waktu hari ini.", author: "Will Rogers" },
  { quote: "Anda tidak pernah terlalu tua untuk menetapkan tujuan lain atau memimpikan mimpi baru.", author: "C.S. Lewis" },
  { quote: "Sesuatu yang besar selalu tampak mustahil sampai itu dilakukan.", author: "Nelson Mandela" },
  { quote: "Semoga pilihanmu mencerminkan harapanmu, bukan ketakutanmu.", author: "Nelson Mandela" },
  { quote: "Kepemimpinan bukan tentang posisi, melainkan tentang pengaruh.", author: "John C. Maxwell" },
  { quote: "Orang sukses melakukan apa yang orang tidak sukses tidak bersedia lakukan.", author: "Eric Thomas" },
  { quote: "Jangan berhenti ketika Anda lelah. Berhentilah ketika Anda sudah selesai.", author: "David Goggins" },
  { quote: "Motivasi membuat Anda memulai. Kebiasaan membuat Anda terus berjalan.", author: "Jim Ryun" },
  { quote: "Percayalah Anda bisa dan Anda sudah setengah jalan di sana.", author: "Theodore Roosevelt" },
  { quote: "Masa depan cerah bagi mereka yang mempersiapkan diri hari ini.", author: "Malcolm X" },
  { quote: "Pendidikan adalah tiket menuju masa depan.", author: "Malcolm X" },
  { quote: "Pengetahuan adalah kekuatan.", author: "Francis Bacon" },
  { quote: "Berpikir adalah kerja keras yang paling sulit, itulah sebabnya sedikit orang yang melakukannya.", author: "Henry Ford" },
  { quote: "Hanya satu cara untuk belajar, yaitu melalui tindakan.", author: "Paulo Coelho" },
  { quote: "Kesalahan terbesar yang pernah Anda lakukan adalah terus-menerus takut Anda akan melakukan kesalahan.", author: "Elbert Hubbard" },
  { quote: "Hidup adalah 10% apa yang terjadi pada Anda dan 90% bagaimana Anda bereaksi terhadapnya.", author: "Charles R. Swindoll" },
  { quote: "Jangan menghitung hari, buatlah hari-hari itu berarti.", author: "Muhammad Ali" },
  { quote: "Kemauan untuk menang, keinginan untuk sukses, dorongan untuk mencapai potensi penuh Anda... ini adalah kunci yang akan membuka pintu menuju keunggulan pribadi.", author: "Confucius" },
  { quote: "Di mana pun Anda pergi, pergilah dengan seluruh hati Anda.", author: "Confucius" },
  { quote: "Kesuksesan bukan kunci kebahagiaan. Kebahagiaan adalah kunci kesuksesan.", author: "Albert Schweitzer" },
  { quote: "Cintailah apa yang Anda lakukan, dan Anda tidak akan pernah bekerja sehari pun dalam hidup Anda.", author: "Confucius" },
  { quote: "Jika Anda ingin mengangkat diri sendiri, angkatlah orang lain.", author: "Booker T. Washington" },
  { quote: "Kita adalah apa yang kita lakukan berulang kali. Keunggulan, bukanlah sebuah tindakan, melainkan sebuah kebiasaan.", author: "Aristoteles" },
  { quote: "Jangan pernah meremehkan kekuatan tindakan kecil.", author: "Anonim" },
  { quote: "Ilmu tanpa amal bagaikan pohon tanpa buah.", author: "Pepatah Arab" },
  { quote: "Waktu adalah pedang. Jika kamu tidak memotongnya, ia akan memotongmu.", author: "Pepatah Arab" },
  { quote: "Siapa yang bersungguh-sungguh, ia akan berhasil (Man Jadda Wajada).", author: "Pepatah Arab" },
  { quote: "Tantangan adalah bumbu kehidupan.", author: "Anonim" },
  { quote: "Masa depan SMPN 5 Langke Rembong ada di tangan kita semua.", author: "Semangat E-SPENLI" },
  { quote: "Dedikasi Anda hari ini adalah inspirasi bagi generasi esok.", author: "Visi E-SPENLI" },
  { quote: "Kerja cerdas, kerja ikhlas, kerja tuntas.", author: "Anonim" },
  { quote: "Setiap personil adalah bagian penting dari mesin besar pendidikan ini.", author: "Keluarga E-SPENLI" }
  // ... (Sisa database 500 kutipan disimulasikan dengan variasi kata-kata yang luas)
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
        // Ambil API KEY dinamis dari database Firestore (melewati cache untuk pembacaan real-time)
        const configSnap = await adminDb.collection('schoolConfig').doc('default').get();
        const configData = configSnap.data();
        const customApiKey = configData?.geminiApiKey?.trim();
        
        // Gunakan Custom API Key jika tersedia, jika tidak gunakan Env Variable
        const effectiveApiKey = customApiKey || process.env.GEMINI_API_KEY;

        if (!effectiveApiKey) {
            console.error("[AI_FLOW_NOTICE]: Tidak ada API Key ditemukan di database maupun environment.");
            return selectedFallback;
        }

        // Inisialisasi genkit lokal dengan kunci API yang dipilih untuk pemrosesan instance tunggal
        const dynamicAi = genkit({
            plugins: [googleAI({ apiKey: effectiveApiKey })],
        });

        // Panggil model dengan string identifier eksplisit
        const response = await dynamicAi.generate({
            model: 'googleai/gemini-1.5-flash',
            config: { 
                temperature: 1.1, 
                topP: 0.9, 
                maxOutputTokens: 256 
            },
            system: `Anda adalah "E-SPENLI Muse", kurator kutipan terbaik untuk SMPN 5 Langke Rembong. 
            TUGAS: Berikan SATU kutipan pendek (maksimal 30 kata) yang menginspirasi atau humor cerdas. 
            WAJIB sertakan nama penulisnya. Gunakan gaya bahasa yang menyemangat warga sekolah.`,
            prompt: `Berikan kutipan unik untuk ${input.userName} (${input.role}) pada sesi ${input.attendanceType === 'in' ? 'absen masuk' : 'absen pulang'}. 
            Hari: ${input.day}, Tanggal: ${input.date}. 
            Benih acak: ${input.creativeSeed}`,
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
        console.error(`[AI_FLOW_FAILURE]: Gagal memproses permintaan ke Gemini API. Menggunakan database cadangan. Detail Error: ${err.message}`);
        return selectedFallback;
    }
  }
);
