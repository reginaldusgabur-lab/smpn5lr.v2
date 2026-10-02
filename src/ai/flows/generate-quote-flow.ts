'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan nyata dari tokoh dunia/nasional.
 * Sistem bertindak sebagai kurator kutipan inspiratif yang sangat acak dan unik 
 * untuk setiap user di setiap sesi absensi.
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
 * Daftar 50 kutipan cadangan dari tokoh nyata untuk menjamin variasi 
 * saat AI mengalami kendala teknis.
 */
const fallbacks = [
  { quote: "Ing Ngarsa Sung Tuladha, Ing Madya Mangun Karsa, Tut Wuri Handayani.", author: "Ki Hajar Dewantara" },
  { quote: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan itu Anda dapat mengubah dunia.", author: "Nelson Mandela" },
  { quote: "Hiduplah seolah engkau mati besok. Belajarlah seolah engkau hidup selamanya.", author: "Mahatma Gandhi" },
  { quote: "Akar pendidikan itu pahit, tapi buahnya manis.", author: "Aristoteles" },
  { quote: "Tujuan utama pendidikan bukanlah pengetahuan, melainkan tindakan.", author: "Herbert Spencer" },
  { quote: "Imajinasi lebih penting daripada pengetahuan.", author: "Albert Einstein" },
  { quote: "Di mana pun Anda berada, pergilah dengan segenap hati.", author: "Confucius" },
  { quote: "Habis gelap terbitlah terang.", author: "RA Kartini" },
  { quote: "Investasi dalam pengetahuan membayar bunga terbaik.", author: "Benjamin Franklin" },
  { quote: "Belajar tidak pernah melelahkan pikiran.", author: "Leonardo da Vinci" },
  { quote: "Satu anak, satu guru, satu buku, dan satu pena dapat mengubah dunia.", author: "Malala Yousafzai" },
  { quote: "Satu-satunya kebijaksanaan sejati adalah mengetahui bahwa Anda tidak tahu apa-apa.", author: "Socrates" },
  { quote: "Keberhasilan bukanlah milik orang pintar, keberhasilan adalah milik mereka yang senantiasa berusaha.", author: "B.J. Habibie" },
  { quote: "Optimisme adalah kepercayaan yang mengarah pada pencapaian.", author: "Helen Keller" },
  { quote: "Rahasia untuk maju adalah memulai.", author: "Mark Twain" },
  { quote: "Tujuan pendidikan itu untuk mempertajam kecerdasan, memperkukuh kemauan serta memperhalus perasaan.", author: "Tan Malaka" },
  { quote: "Pendidikan bukan mengisi wadah, tapi menyalakan api.", author: "William Butler Yeats" },
  { quote: "Masa depan adalah milik mereka yang percaya pada keindahan mimpi mereka.", author: "Eleanor Roosevelt" },
  { quote: "Satu-satunya cara untuk melakukan pekerjaan hebat adalah dengan mencintai apa yang Anda lakukan.", author: "Steve Jobs" },
  { quote: "Siapa pun yang berhenti belajar adalah orang tua, baik di usia dua puluh atau delapan puluh.", author: "Henry Ford" },
  { quote: "Anda tidak dapat menghabiskan kreativitas. Semakin banyak Anda gunakan, semakin banyak yang Anda miliki.", author: "Maya Angelou" },
  { quote: "Arah pendidikan yang diberikan kepada seseorang akan menentukan masa depannya.", author: "Plato" },
  { quote: "Pendidikan adalah paspor menuju masa depan.", author: "Malcolm X" },
  { quote: "Lakukan apa yang harus Anda lakukan sampai Anda bisa melakukan apa yang ingin Anda lakukan.", author: "Oprah Winfrey" },
  { quote: "Jangan pergi ke mana jalan itu mengarah, pergilah ke tempat yang tidak ada jalan dan tinggalkan jejak.", author: "Ralph Waldo Emerson" },
  { quote: "Semua impian kita bisa menjadi kenyataan jika kita memiliki keberanian untuk mengejarnya.", author: "Walt Disney" },
  { quote: "Gantungkan cita-citamu setinggi langit! Bermimpilah setinggi langit.", author: "Soekarno" },
  { quote: "Anda tidak bisa mengajari seseorang apa pun; Anda hanya bisa membantunya menemukannya di dalam dirinya sendiri.", author: "Galileo Galilei" },
  { quote: "Tujuan pendidikan adalah membuat murid menyukai apa yang harus mereka sukai.", author: "C.S. Lewis" },
  { quote: "Pendidikan bukanlah persiapan untuk hidup; pendidikan adalah hidup itu sendiri.", author: "John Dewey" },
  { quote: "Tugas kita bukanlah untuk berhasil. Tugas kita adalah untuk mencoba.", author: "Buya Hamka" },
  { quote: "Jangan pernah ragu bahwa sekelompok kecil warga yang peduli dan berkomitmen dapat mengubah dunia.", author: "Margaret Mead" },
  { quote: "Dua jalan bercabang di hutan, dan aku mengambil jalan yang jarang dilalui.", author: "Robert Frost" },
  { quote: "Tidak ada yang mustahil, kata itu sendiri mengatakan 'aku mungkin' (I'm possible).", author: "Audrey Hepburn" },
  { quote: "Kesuksesan bukanlah akhir, kegagalan bukanlah fatal: keberanian untuk melanjutkanlah yang terpenting.", author: "Winston Churchill" },
  { quote: "Saya tidak gagal. Saya baru saja menemukan 10.000 cara yang tidak berhasil.", author: "Thomas Edison" },
  { quote: "Cara terbaik untuk memprediksi masa depan adalah dengan menciptakannya.", author: "Abraham Lincoln" },
  { quote: "Seseorang tidak pernah memperhatikan apa yang telah dilakukan; seseorang hanya melihat apa yang masih harus dilakukan.", author: "Marie Curie" },
  { quote: "Hanya ada satu cara untuk belajar, yaitu melalui tindakan.", author: "Paulo Coelho" },
  { quote: "Dia yang membuka pintu sekolah, menutup penjara.", author: "Victor Hugo" },
  { quote: "Kebahagiaan bukan sesuatu yang sudah jadi. Itu berasal dari tindakan Anda sendiri.", author: "Dalai Lama" },
  { quote: "Pendidikan adalah jalan menuju kebebasan, kebahagiaan, dan kemakmuran.", author: "Booker T. Washington" },
  { quote: "Pendidikan formal akan membuat Anda hidup; pendidikan mandiri akan membuat Anda kaya.", author: "Jim Rohn" },
  { quote: "Anda tidak harus hebat untuk memulai, tetapi Anda harus memulai untuk menjadi hebat.", author: "Zig Ziglar" },
  { quote: "Betapa indahnya bahwa tidak ada yang perlu menunggu satu saat pun sebelum mulai memperbaiki dunia.", author: "Anne Frank" },
  { quote: "Kecerdasan ditambah karakter—itulah tujuan pendidikan sejati.", author: "Martin Luther King Jr." },
  { quote: "Selagi kita mengajar, kita belajar.", author: "Seneca" },
  { quote: "Pekerjaan adalah cinta yang dibuat nyata.", author: "Khalil Gibran" },
  { quote: "Kemarin saya pintar, jadi saya ingin mengubah dunia. Hari ini saya bijak, jadi saya mengubah diri saya sendiri.", author: "Rumi" },
  { quote: "Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang dari sejarah.", author: "Pramoedya Ananta Toer" }
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
    const hash = getHash(`${input.userId}|${input.creativeSeed}`);
    const selectedFallback = fallbacks[hash % fallbacks.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.2,
          topP: 0.9,
          maxOutputTokens: 200,
        },
        system: `Anda adalah "E-SPENLI Oracle", kurator kutipan tokoh dunia.
TUGAS: Berikan SATU kutipan nyata dan pendek dari tokoh terkenal untuk personil sekolah.

ATURAN:
1. Wajib kutipan asli dari tokoh sejarah, ilmuwan, atau pendidik.
2. Gaya bahasa harus bijak dan menginspirasi.
3. Gunakan Bahasa Indonesia yang sangat baik.
4. Jangan gunakan kata-kata klise seperti "Pahlawan tanpa tanda jasa".
5. Tanpa emoji.`,
        prompt: `Berikan kutipan inspiratif untuk ${input.userName} yang berperan sebagai ${input.role} pada sesi absen ${input.attendanceType === 'in' ? 'pagi' : 'sore'}. Gunakan benih kreatif: ${input.creativeSeed}`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output || !response.output.quote) throw new Error('AI_OFFLINE');
      return response.output;
    } catch (err: any) {
      console.warn('[AI_FALLBACK_ACTIVE]: Menggunakan kutipan cadangan berkualitas tinggi.');
      return selectedFallback;
    }
  }
);
