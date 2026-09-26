'use server';
/**
 * @fileOverview AI Flow untuk menyajikan kutipan nyata dari tokoh dunia/nasional.
 * Sistem bertindak sebagai kurator kutipan inspiratif yang relevan dengan 
 * dunia pendidikan, masyarakat, dan pengabdian.
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
    
    // Tentukan Kategori Tokoh berdasarkan Hash untuk variasi
    const categories = [
        "Tokoh Pendidikan Indonesia (Ki Hajar Dewantara, RA Kartini, dll)",
        "Filsuf Klasik (Socrates, Plato, Marcus Aurelius)",
        "Pemimpin Dunia (Nelson Mandela, Winston Churchill, Bung Karno)",
        "Ilmuwan & Inovator (Albert Einstein, Marie Curie, B.J. Habibie)",
        "Tokoh Kemanusiaan (Bunda Teresa, Mahatma Gandhi)"
    ];
    const selectedCategory = categories[hash % categories.length];

    // Tema berdasarkan peran
    let focusTheme = "Pendidikan dan pengabdian masyarakat.";
    if (input.role === 'kepala_sekolah') focusTheme = "Kepemimpinan, visi, dan tanggung jawab sosial.";
    if (input.role === 'guru') focusTheme = "Inspirasi belajar, kesabaran, dan mencerdaskan bangsa.";
    if (input.role === 'pegawai') focusTheme = "Dedikasi, integritas dalam pelayanan, dan kerjasama tim.";

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.0,
          maxOutputTokens: 200,
        },
        system: `Anda adalah "Kurator Kebijaksanaan E-SPENLI". 
TUGAS: Berikan SATU kutipan nyata (asli) dari tokoh terkenal (nasional atau internasional).
Kutipan harus berkaitan dengan: ${focusTheme}

PANDUAN:
1. Cari kutipan dari kategori: ${selectedCategory}.
2. Kutipan harus relevan untuk sesi ${isEntry ? 'memulai pekerjaan di pagi hari' : 'mengakhiri pekerjaan di sore hari'}.
3. Prioritaskan tokoh pendidikan Indonesia jika memungkinkan.
4. Gunakan bahasa Indonesia yang baik dan benar (terjemahkan dengan anggun jika kutipan asli berbahasa asing).
5. Output harus berupa kutipan teks dan nama tokoh secara akurat.

LARANGAN:
- JANGAN membuat kutipan palsu atau anonim.
- JANGAN memberikan kutipan motivasi yang terlalu pasaran/klise tanpa tokoh yang jelas.`,
        prompt: `Sajikan satu kutipan bijak untuk ${input.userName} (Peran: ${input.role}) pada hari ${input.day}, ${input.date}. 
Gunakan variasi entropi: ${input.creativeSeed} untuk memastikan pilihan tokoh yang berbeda dari sebelumnya.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output || !response.output.quote) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_QUOTE_FLOW_ERROR]:', err.message);
      const fallback = fallbacks[hash % fallbacks.length];
      return fallback;
    }
  }
);
