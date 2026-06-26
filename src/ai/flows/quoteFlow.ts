'use server';
/**
 * @fileOverview Flow untuk menghasilkan kutipan motivasi/lucu.
 */

import { z } from 'zod';
import { generate } from '@genkit-ai/ai';
import { model } from '@/ai/genkit'; // Mengimpor model yang sudah dikonfigurasi

const QuoteInputSchema = z.object({
  category: z
    .string()
    .describe('Peran audiens target, contoh: "guru", "kepala sekolah", "pegawai".'),
  attendanceType: z
    .enum(['in', 'out'])
    .describe('Jenis absensi: "in" untuk masuk, "out" untuk pulang.'),
});
export type QuoteInput = z.infer<typeof QuoteInputSchema>;

const QuoteOutputSchema = z.object({
  quote: z
    .string()
    .describe('Teks kutipan yang dihasilkan.'),
  author: z
    .string()
    .describe('Nama penulis fiktif yang sesuai dengan konteks kutipan.'),
});
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

/**
 * Menghasilkan kutipan menggunakan model AI Genkit.
 */
export async function getQuote(input: QuoteInput): Promise<QuoteOutput> {

  // Membuat prompt dinamis berdasarkan input
  const dynamicPrompt = `Buat satu kutipan motivasi singkat (tidak lebih dari 20 kata) dalam Bahasa Indonesia untuk seorang ${input.category} yang sedang melakukan absensi ${input.attendanceType === 'in' ? 'masuk' : 'pulang'}. Kutipan harus dalam format JSON yang bisa di-parse. Pastikan tidak ada formatting markdown, hanya JSON mentah.

Contoh format yang benar:
{
  "quote": "Selamat datang! Semoga harimu penuh inspirasi.",
  "author": "Penyambut Pagi"
}

Contoh format lain:
{
  "quote": "Terima kasih untuk kerja kerasmu hari ini. Selamat beristirahat.",
  "author": "Sang Penutup Hari"
}
`;

  try {
    const llmResponse = await generate({
      model: model,
      messages: [{ role: 'user', content: dynamicPrompt }], // Menggunakan format `messages` yang benar
      output: {
        schema: QuoteOutputSchema,
        format: 'json', // Memastikan output adalah JSON
      },
      config: {
        temperature: 0.8, // Sedikit lebih kreatif
      }
    });

    const output = llmResponse.output();
    if (!output) {
      throw new Error("AI response was empty but no error was thrown.");
    }
    return output;

  } catch (error) {
    console.error("---!!! TERJADI ERROR DI FUNGSI getQuote !!!---");
    console.error("[PESAN ERROR ASLI DARI AI]:", error);
    console.error("------------------------------------------");

    // Jika AI gagal karena alasan apa pun, kembalikan kutipan darurat
    return {
      quote: "Apapun hasilnya, tetaplah bangga pada usahamu hari ini.",
      author: "Sistem E-Spenli",
    };
  }
}
