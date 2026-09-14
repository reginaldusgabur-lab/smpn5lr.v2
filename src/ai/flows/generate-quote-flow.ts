'use server';
/**
 * @fileOverview AI Flow untuk menghasilkan kutipan motivasi yang SANGAT UNIK per pengguna.
 * Menggunakan identitas unik pengguna (userId & userName) untuk menjamin variasi yang berbeda 
 * antar personil meskipun pada hari dan status absen yang sama.
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
 * Kutipan cadangan berbasis hash untuk menjamin keunikan 
 * bahkan saat kondisi offline atau kegagalan API AI.
 */
const fallbacks = {
  in: [
    "Pagi adalah awal baru untuk jiwa yang ikhlas mendidik. Semangat menyinari kelas!",
    "Kopi pagi ini adalah doa, pengabdian adalah ibadah. Selamat bertugas.",
    "Setiap murid adalah kanvas kosong, jadilah kuas yang memberi warna hari ini.",
    "Dedikasi Anda adalah pondasi masa depan mereka. Mari menyapa kelas dengan senyum.",
    "Tantangan hari ini adalah peluang untuk memberi inspirasi. Selamat mengabdi."
  ],
  out: [
    "Tuntas sudah perjuangan hari ini. Waktunya pulang dan mengisi ulang energi.",
    "Istirahatlah dengan tenang, keluarga menanti cerita hebat Anda di rumah.",
    "Beban kerja tuntas, kehangatan keluarga menunggu. Hati-hati di jalan.",
    "Terima kasih atas ketulusan Anda mengabdi hari ini. Selamat bersantai.",
    "Besok adalah petualangan baru, sore ini adalah kemenangan untuk diri sendiri."
  ]
};

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
    
    // Tentukan Persona berdasarkan Hash untuk variasi radikal antar user
    const personas = [
      "Filosof Stoik (fokus pada ketenangan, logika, dan tugas mulia sebagai pengabdian)",
      "Penyair Kontemporer (fokus pada metafora alam, cahaya, dan harmoni dalam pendidikan)",
      "Arsitek Visi (fokus pada struktur, pondasi masa depan, dan presisi dalam bekerja)",
      "Rekan Energik (fokus pada antusiasme, keceriaan, dan aksi nyata yang berdampak)",
      "Navigator Bijak (fokus pada arah, kompas moral, dan perjalanan panjang ilmu pengetahuan)"
    ];
    const selectedPersona = personas[hash % personas.length];

    const fallbackList = isEntry ? fallbacks.in : fallbacks.out;
    const selectedFallback = fallbackList[hash % fallbackList.length];

    // Petunjuk tema berdasarkan Role
    let roleTheme = "";
    const r = input.role.toLowerCase();
    if (r === 'kepala_sekolah') {
      roleTheme = "Fokus pada kepemimpinan, visi sekolah, integritas, dan orkestrasi kebijakan yang melayani.";
    } else if (r === 'guru') {
      roleTheme = "Fokus pada inspirasi kelas, kesabaran mendampingi murid, cahaya ilmu, dan keteladanan moral.";
    } else if (r === 'pegawai') {
      roleTheme = "Fokus pada efisiensi sistem, detak jantung administrasi, profesionalisme, dan harmoni pelayanan.";
    } else {
      roleTheme = "Fokus pada disiplin, pertumbuhan diri, dan kontribusi positif bagi lingkungan sekolah.";
    }

    try {
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        config: {
          temperature: 1.4, // Suhu tinggi untuk mencegah repetisi kata
          topP: 0.95,
          maxOutputTokens: 150,
        },
        system: `Anda adalah "E-SPENLI Muse", generator kutipan yang sangat personal dan cerdas untuk personil sekolah.
TUGAS: Buat SATU kutipan pendek (15-25 kata) yang disesuaikan khusus untuk identitas pengguna ini.

GAYA BAHASA ANDA SAAT INI: Tuliskan kutipan dengan gaya sebagai "${selectedPersona}".

KONTEKS PERAN (Wajib dipatuhi):
${roleTheme}

PEMBEDA SESI:
- Jika Masuk (IN): Fokus pada kesiapan mental, niat baik, dan energi awal untuk mulai berkarya.
- Jika Pulang (OUT): Fokus pada refleksi, rasa syukur atas tugas yang tuntas, dan peralihan ke waktu istirahat bersama keluarga.

DAFTAR TERLARANG (JANGAN GUNAKAN):
"Pahlawan tanpa tanda jasa", "Masa depan bangsa", "Semangat pagi", "Pantang menyerah", "Setiap hari adalah", "Mari kita".

ATURAN KETAT:
- Jangan sebutkan nama peran secara eksplisit (misal: "Wahai Kepala Sekolah"). Biarkan konteksnya saja yang terasa.
- Gunakan metafora yang segar (misal: tentang tenun, arus air, navigasi bintang, atau simfoni).
- Tanpa emoji. Tanpa sajak berima. Tanpa pantun.`,
        prompt: `PARAMETER UNIK:
- Nama Pengguna: ${input.userName}
- Identitas Benih (Seed): ${input.userId}
- Sesi Absensi: ${isEntry ? 'MASUK (Fajar/Mulai)' : 'PULANG (Senja/Selesai)'}
- Tanggal: ${input.date}
- Varian Entropi: ${input.creativeSeed}

Buatlah kalimat yang benar-benar baru, tajam, dan hanya terasa relevan untuk personil ini pada sesi ${isEntry ? 'pagi' : 'sore'} ini. JANGAN pernah mengulang pola kalimat sebelumnya.`,
        output: { schema: QuoteOutputSchema },
      });

      if (!response.output) throw new Error('AI_EMPTY_RESPONSE');
      return response.output;
    } catch (err: any) {
      console.error('[AI_QUOTE_FLOW_ERROR]:', err.message);
      return {
        quote: selectedFallback,
        author: "AI E-SPENLI"
      };
    }
  }
);
