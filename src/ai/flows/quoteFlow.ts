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
 * Ini adalah implementasi AI yang sebenarnya, menggantikan bypass sementara.
 */
export async function getQuote(input: QuoteInput): Promise<QuoteOutput> {
  // [DIAGNOSTIC] Menggunakan prompt statis untuk mengisolasi masalah
  const llmResponse = await generate({
    model: model,
    prompt: `Buat satu kutipan motivasi singkat dalam Bahasa Indonesia dalam format JSON. Contoh: {"quote": "Semangat!", "author": "AI"}`,
    output: {
      schema: QuoteOutputSchema,
    },
  });

  const output = llmResponse.output();
  if (!output) {
    // Jika AI gagal memberikan output, kembalikan kutipan darurat
    return {
      quote: "Apapun hasilnya, tetaplah bangga pada usahamu hari ini.",
      author: "Sistem E-Spenli",
    };
  }
  return output;
}
