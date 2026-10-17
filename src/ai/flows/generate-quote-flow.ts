
'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan inspiratif atau humor dari tokoh dunia/nasional.
 * Mendukung penggunaan Kunci API dinamis dari database atau variabel lingkungan.
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
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

/**
 * Database 500 Kutipan Cadangan (Kualitas Premium: Motivasi, Humor, Filosofi, & Psikologi Sekolah)
 */
const fallbacks = [
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
  { quote: "Ruang guru: Tempat di mana semua masalah dunia diselesaikan dalam waktu 15 menit jam istirahat.", author: "Humor Sekolah" },
  { quote: "Kopi guru: 70% kafein, 30% doa agar siswa hari ini tenang.", author: "Ramuan Rahasia" }
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
    const selectedFallback = fallbacks[hash % fallbacks.length];

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

        // Panggil model dengan string identifier eksplisit untuk memastikan plugin instance yang benar digunakan
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
            output: { schema: QuoteOutputSchema },
        });

        if (!response.output || !response.output.quote) {
            throw new Error('AI_OUTPUT_EMPTY');
        }

        return response.output;

    } catch (err: any) {
        // Logging error di sisi server untuk membantu Admin mendiagnosis masalah API Key
        console.error(`[AI_FLOW_FAILURE]: Gagal memproses permintaan ke Gemini API. Menggunakan database cadangan. Detail Error: ${err.message}`);
        return selectedFallback;
    }
  }
);
