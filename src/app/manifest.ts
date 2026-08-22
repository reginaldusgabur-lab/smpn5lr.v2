
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'E-SPENLI',
    short_name: 'E-SPENLI',
    description: 'Sistem Informasi Absensi SMPN 5 Langke Rembong',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [], // Dikosongkan sementara untuk diagnosa pendobelan logo
  }
}
