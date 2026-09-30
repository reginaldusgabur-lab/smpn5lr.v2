'use server';
/**
 * @fileOverview Sinkronisasi alur kerja kutipan ke model Gemini 1.5 Flash.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const QuoteOutputSchema = z.object({
  quote: z.string(),
  author: z.string(),
});

export async function getQuote(input: { category: string; attendanceType: 'in' | 'out' }) {
  try {
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: `Buat kutipan motivasi singkat untuk ${input.category} saat absen ${input.attendanceType}.`,
      output: { schema: QuoteOutputSchema }
    });

    return response.output || { quote: "Tetap semangat!", author: "Sistem E-SPENLI" };
  } catch (error) {
    console.error("Gemini API Error:", error);
    console.error("Simple Quote Error:", error);
    return { quote: "Tetap semangat menyongsong hari!", author: "Sistem E-SPENLI" };
  }
}
