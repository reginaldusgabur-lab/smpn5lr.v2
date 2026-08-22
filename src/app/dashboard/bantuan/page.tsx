'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ShieldAlert, HelpCircle } from 'lucide-react';

export default function BantuanPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <Card className="rounded-3xl border border-muted-foreground/10 shadow-md overflow-hidden bg-card">
        <div className="bg-primary/5 p-8 border-b border-muted-foreground/10 flex flex-col items-center text-center">
          <HelpCircle className="h-12 w-12 text-primary mb-4" />
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-primary">Panduan & FAQ E-SPENLI</CardTitle>
            <CardDescription className="font-bold text-xs text-muted-foreground uppercase tracking-widest">
              Pusat bantuan pengguna aplikasi
            </CardDescription>
          </div>
        </div>
        
        <CardContent className="p-6 sm:p-8 space-y-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Apa kegunaan aplikasi E-SPENLI?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                E-SPENLI adalah sistem absensi digital modern untuk SMPN 5 Langke Rembong. Aplikasi ini mendokumentasikan kehadiran secara real-time berdasarkan QR Code, lokasi GPS, dan waktu absensi untuk menjamin akurasi data staf dan guru.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Fungsi Indikator Sinyal?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-2 text-xs font-medium leading-relaxed text-muted-foreground">
                <p>Titik kecil di samping informasi peran (role) Anda adalah pemantau stabilitas internet Anda:</p>
                <ul className="list-disc pl-4 space-y-1 font-bold text-[11px]">
                  <li><span className="text-green-600">Hijau</span>: Sinyal kuat, aman untuk absen.</li>
                  <li><span className="text-amber-500">Kuning</span>: Sinyal lemah, mungkin sedikit lambat.</li>
                  <li><span className="text-red-500">Merah</span>: Sinyal buruk, risiko gagal kirim data.</li>
                  <li><span className="text-gray-400">Abu-abu</span>: Anda sedang offline (tidak ada internet).</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Fungsi Ikon Tema (Matahari/Bulan)?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                Tombol di pojok kanan atas ini digunakan untuk mengubah tampilan aplikasi. Ikon Matahari mengaktifkan <strong>Mode Terang</strong> (latar putih), sementara ikon Bulan mengaktifkan <strong>Mode Gelap</strong> (latar hitam) yang lebih nyaman di mata saat kondisi minim cahaya.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Cara Ganti Foto Profil?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-3 text-xs font-medium leading-relaxed text-muted-foreground">
                <ol className="list-decimal pl-4 space-y-1 font-bold text-[11px]">
                  <li>Klik ikon/nama Anda atau buka menu <strong>Pengaturan</strong>.</li>
                  <li>Klik tombol ikon kamera di samping foto profil Anda.</li>
                  <li>Pilih foto dari galeri HP atau komputer Anda.</li>
                  <li>Tunggu proses unggah, lalu klik <strong>Simpan Profil</strong>.</li>
                </ol>
                <div className="bg-background/50 p-2 rounded-lg border border-primary/10 mt-2">
                  <p className="font-black text-primary text-[10px] uppercase">Rekomendasi Ukuran:</p>
                  <p className="text-[10px] italic">Gunakan foto rasio 1:1 (Persegi), resolusi minimal 400x400 px, dan ukuran file maksimal 750KB untuk hasil terbaik.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Masalah izin kamera (Camera blocked)?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-3 text-xs font-medium leading-relaxed text-muted-foreground">
                <p>Jika kamera tidak muncul, kemungkinan besar Anda telah menolak izin akses kamera sebelumnya. Untuk mengatasinya:</p>
                <ul className="text-[11px] font-bold text-muted-foreground list-disc pl-4 space-y-1">
                  <li>Klik ikon "Gembok" di bilah alamat browser (URL).</li>
                  <li>Pastikan "Kamera" dalam posisi Izinkan (Allowed).</li>
                  <li>Segarkan (Refresh) halaman dan coba scan kembali.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Kendala batas waktu absensi?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                Tombol absen hanya akan muncul saat jadwal masuk (pagi) atau jadwal pulang (sore) telah dibuka oleh Admin. Jika Anda berada di luar jendela waktu tersebut, aplikasi akan menampilkan pesan "Batas jam masuk berakhir" atau "Belum waktu jam pulang". Pastikan Anda melakukan absen tepat waktu.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Gagal absen karena masalah lokasi?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                Aplikasi mewajibkan Anda berada dalam radius sekolah. Jika gagal, pastikan GPS di HP aktif. Cobalah untuk berpindah ke area yang lebih terbuka agar sinyal satelit dapat mengunci posisi Anda dengan lebih akurat.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Lupa kata sandi?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                Untuk alasan keamanan, silakan hubungi Administrator Sistem di kantor sekolah untuk mereset kata sandi Anda secara manual. Setelah masuk, segera ganti dengan sandi pribadi di menu Pengaturan.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="pt-6 border-t border-muted-foreground/10 flex items-start gap-4 bg-primary/5 p-5 rounded-2xl">
            <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-tight mb-1">Integritas Data</p>
              <p className="text-[11px] font-bold text-muted-foreground leading-tight italic">
                "Kejujuran adalah fondasi pendidikan. Sistem E-SPENLI dilengkapi dengan verifikasi otomatis waktu dan lokasi untuk memastikan validitas kehadiran kita semua."
              </p>
            </div>
          </div>

          <div className="text-center pb-4">
            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">SMP NEGERI 5 LANGKE REMBONG © 2026</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
