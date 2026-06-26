import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
});

// Definisikan model menggunakan factory untuk stabilitas
// Menggunakan model yang lebih baru dan efisien untuk kompatibilitas yang lebih baik.
export const model = googleAI.model('gemini-1.5-flash');
