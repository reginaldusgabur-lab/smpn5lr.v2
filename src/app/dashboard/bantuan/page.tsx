'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ShieldAlert, HelpCircle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

            <AccordionItem value="item-9" className="border-none mb-2">
              <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                <span className="font-bold text-sm text-left">Bagaimana perhitungan persentase kehadiran?</span>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-4 text-xs font-medium leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">Sistem menggunakan nilai poin harian untuk menghitung persentase akhir:</p>
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center p-2 bg-background rounded-lg border">
                        <span className="font-bold">Hadir / Dinas / Luar Sekolah</span>
                        <Badge className="bg-green-600 border-none shadow-sm h-6 px-3">1.0 Poin</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background rounded-lg border">
                        <span className="font-bold">Terlambat / Pulang Cepat</span>
                        <Badge className="bg-amber-500 border-none shadow-sm h-6 px-3">0.95 Poin</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background rounded-lg border">
                        <span className="font-bold">Sakit (Disetujui)</span>
                        <Badge className="bg-blue-600 border-none shadow-sm h-6 px-3">0.9 Poin</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background rounded-lg border">
                        <span className="font-bold">Izin Pribadi (Disetujui)</span>
                        <Badge className="bg-blue-400 border-none shadow-sm h-6 px-3">0.7 Poin</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background rounded-lg border">
                        <span className="font-bold">Lupa Absen (Masuk saja / Pulang saja)</span>
                        <Badge className="bg-orange-50 border-none shadow-sm h-6 px-3 text-orange-700">0.5 Poin</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background rounded-lg border">
                        <span className="font-bold text-destructive">Alpa / Tanpa Keterangan</span>
                        <Badge variant="destructive" className="border-none shadow-sm h-6 px-3">0.0 Poin</Badge>
                    </div>
                </div>
                <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        <p className="text-[10px] font-black uppercase text-primary tracking-tighter">Rumus Persentase:</p>
                    </div>
                    <p className="text-[11px] font-bold italic text-foreground/80">(Total Akumulasi Poin ÷ Total Hari Kerja Efektif) x 100%</p>
                </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
