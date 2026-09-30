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
 * Kutipan cadangan dari tokoh nyata jika AI mengalami kendala.
 */
const fallbacks = [
  { quote: "Ing Ngarsa Sung Tuladha, Ing Madya Mangun Karsa, Tut Wuri Handayani.", author: "Ki Hajar Dewantara" },
  { quote: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan, Anda dapat mengubah dunia.", author: "Nelson Mandela" },
  { quote: "Hiduplah seolah engkau mati besok. Belajarlah seolah engkau hidup selamanya.", author: "Mahatma Gandhi" },
  { quote: "Akar pendidikan itu pahit, tapi buahnya manis.", author: "Aristoteles" },
  { quote: "Tujuan utama pendidikan bukanlah pengetahuan, melainkan tindakan.", author: "Herbert Spencer" }
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
    const isEntry = input.attendanceType === 'in';
    const hash = getHash(`${input.userId}|${input.creativeSeed}`);
    
    // Daftar kategori yang sangat luas untuk menjamin keunikan
    const categories = [
        "Tokoh Pendidikan Indonesia (Ki Hajar Dewantara, RA Kartini, Tan Malaka)",
        "Filsuf Stoik dan Klasik (Socrates, Marcus Aurelius, Seneca)",
        "Pemimpin Besar Dunia (Nelson Mandela, Winston Churchill, Soekarno, Gandhi)",
        "Ilmuwan Abad 20 & 21 (Albert Einstein, Stephen Hawking, Marie Curie, B.J. Habibie)",
        "Sastrawan & Penyair Dunia (Rumi, Kahlil Gibran, Pramoedya Ananta Toer, Maya Angelou)",
        "Tokoh Kemanusiaan & Spiritual (Bunda Teresa, Dalai Lama, Gus Dur)",
        "Inovator Visi Modern (Steve Jobs, Elon Musk, Da Vinci)",
        "Pakar Psikologi & Pengembangan Diri (Viktor Frankl, Carl Jung, Brené Brown)",
        "Atlet Legendaris dengan Mentalitas Juara (Muhammad Ali, Kobe Bryant, Pelé)",
        "Pahlawan Nasional Indonesia era Kemerdekaan"
    ];

    const moods = [
        "Sangat bersemangat dan penuh energi",
        "Bijak, tenang, dan reflektif",
        "Tegas, disiplin, dan berwibawa",
        "Hangat, penuh kasih, dan puitis",
        "Logis, tajam, dan analitis"
    ];

    const selectedCategory = categories[hash % categories.length];
    const selectedMood = moods[hash % moods.length];

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        config: {
          temperature: 1.4, // Menaikkan suhu untuk variasi yang lebih liar/kreatif
          topP: 0.95,
          maxOutputTokens: 250,
        },
        system: `Anda adalah "Global Wisdom Oracle" untuk komunitas sekolah E-SPENLI. 
TUGAS: Berikan SATU kutipan nyata (bukan buatan) dari tokoh dunia atau nasional.

PANDUAN KETAT:
1. PILIH TOKOH: Wajib dari kategori "${selectedCategory}".
2. GAYA BAHASA: Sajikan dengan pendekatan yang "${selectedMood}".
3. SESI: Sesuaikan dengan konteks ${isEntry ? 'memulai hari dengan niat mulia' : 'mensyukuri hari yang telah tuntas'}.
4. BAHASA: Gunakan Bahasa Indonesia yang sangat anggun dan menginspirasi (terjemahkan jika perlu).
5. ANTI-KLISE: Jangan berikan kutipan yang terlalu sering didengar. Cari yang "hidden gem" atau mutiara tersembunyi dari tokoh tersebut.
6. AKURASI: Nama tokoh harus benar and kutipan harus benar-benar pernah diucapkan/ditulis oleh mereka.

DILARANG KERAS:
- Memberikan kutipan tanpa nama tokoh.
- Menggunakan kata-kata: "Pahlawan tanpa tanda jasa", "Masa depan bangsa", "Semangat pagi".

IDENTITAS UNIK SESI INI:
- Pengguna: ${input.userName}
- Peran: ${input.role}
- Entropy Seed: ${input.creativeSeed}`,
        prompt: `Berikan satu kutipan inspiratif yang belum pernah Anda berikan sebelumnya untuk personil ini. 
Fokuslah pada esensi "${selectedCategory}" yang bersifat "${selectedMood}".`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output || !response.output.quote) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_QUOTE_FLOW_ERROR]:', err.message);
      return fallbacks[hash % fallbacks.length];
    }
  }
);
