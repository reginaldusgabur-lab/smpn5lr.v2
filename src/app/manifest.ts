import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'E-SPENLI',
    short_name: 'E-SPENLI',
    description: 'Aplikasi Absensi SMPN 5 Langke Rembong',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [], // Dikosongkan total untuk mematikan splash screen sistem
  }
}
