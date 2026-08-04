'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Settings, 
  ShieldAlert, 
  BookOpen, 
  UserCircle, 
  QrCode, 
  FileText, 
  Zap, 
  Power, 
  HelpCircle,
  Info,
  MapPin,
  Lock,
  Camera,
  Clock,
  Sparkles
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { ModeToggle } from '@/components/theme-toggle';
import { NetworkStatusDot } from './NetworkStatusDot';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function Header({ isTransparent }: { isTransparent?: boolean }) {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [isFaqOpen, setIsFaqOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<{ name: string, role: string, photoURL?: string }>(user, userDocRef);

  const handleLogout = () => {
    if (!auth) return;
    signOut(auth).then(() => {
      router.push('/');
    }).catch((error) => {
      console.error("Gagal melakukan logout:", error);
      router.push('/');
    });
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  const displayName = user?.displayName || userData?.name;
  
  const getDisplayRole = () => {
    if (userData?.role) {
      return userData.role.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return "";
  }
  const displayRole = getDisplayRole();
  const currentPhoto = userData?.photoURL || user?.photoURL;
  const isProfileLoading = isUserLoading || isUserDataLoading;

  const headerClasses = `
    fixed top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background px-4 sm:px-6
    transition-opacity duration-300
    sm:left-[16rem] sm:w-[calc(100%-16rem)]
    ${isTransparent ? 'opacity-0 pointer-events-none' : 'opacity-100'}
  `;

  return (
    <header className={headerClasses}>
      <div className="flex items-center gap-3">
        {isProfileLoading && !displayName ? (
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="hidden sm:flex flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
        ) : (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 focus:outline-none rounded-full p-1 -ml-1 sm:p-0 sm:ml-0 group">
                        <Avatar className="h-9 w-9 border border-primary/10 shadow-sm transition-transform group-active:scale-95">
                            <AvatarImage src={currentPhoto ?? undefined} alt="Avatar" />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col justify-center text-left">
                            <p className="text-sm font-bold leading-none tracking-tight">{displayName || 'Pengguna'}</p>
                            <p className="text-[10px] tracking-widest leading-none text-muted-foreground mt-1.5 font-bold uppercase opacity-60">{displayRole || 'User'}</p>
                        </div>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
                    <DropdownMenuLabel className="font-normal px-4 py-4">
                        <div className="flex items-center gap-3">
                            <UserCircle className="h-5 w-5 text-primary opacity-40" />
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-bold leading-none text-primary">{displayName || 'Pengguna'}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {displayRole || 'User'}
                                </p>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="mx-2 opacity-50" />
                    
                    <DropdownMenuItem 
                        onClick={() => router.push('/dashboard/pengaturan')}
                        className="rounded-xl cursor-pointer py-3 px-4 focus:bg-primary/5 group"
                    >
                        <Settings className="mr-3 h-4 w-4 text-primary transition-transform group-hover:rotate-45" />
                        <span className="text-sm font-bold">Pengaturan</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={() => setIsFaqOpen(true)}
                        className="rounded-xl cursor-pointer py-3 px-4 focus:bg-primary/5 group"
                    >
                        <HelpCircle className="mr-3 h-4 w-4 text-primary transition-transform group-hover:scale-110" />
                        <span className="text-sm font-bold">Panduan & FAQ</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="mx-2 opacity-50" />
                    <DropdownMenuItem 
                        onClick={handleLogout} 
                        className="rounded-xl cursor-pointer py-3 px-4 text-destructive focus:bg-destructive/5 focus:text-destructive group"
                    >
                        <Power className="mr-3 h-4 w-4 transition-transform group-hover:scale-110" />
                        <span className="text-sm font-bold uppercase tracking-wider">Keluar</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
        <ModeToggle />
      </div>

      <div className="flex items-center gap-4">
        <NetworkStatusDot />
        <button onClick={() => setIsFaqOpen(true)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full transition-transform active:scale-95">
          <Image
            src="/logo-3d.png"
            alt="App Logo"
            width={36}
            height={36}
            priority
          />
        </button>
      </div>

      {/* Dialog Panduan & FAQ Utama */}
      <Dialog open={isFaqOpen} onOpenChange={setIsFaqOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0">
          <div className="bg-primary/5 p-8 border-b border-muted-foreground/10 flex flex-col items-center text-center">
            <DialogHeader>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-tight text-primary">Panduan & FAQ E-SPENLI</DialogTitle>
                <DialogDescription className="font-bold text-xs text-muted-foreground uppercase tracking-widest">
                  Pusat bantuan pengguna aplikasi
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>
          
          <div className="p-6 sm:p-8 space-y-6">
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
                  <span className="font-bold text-sm text-left">Masalah izin kamera (Camera blocked)?</span>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-3">
                  <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                    Jika kamera tidak muncul, kemungkinan besar Anda telah menolak izin akses kamera sebelumnya. Untuk mengatasinya:
                  </p>
                  <ul className="text-[11px] font-bold text-muted-foreground list-disc pl-4 space-y-1">
                    <li>Klik ikon "Gembok" di bilah alamat browser (URL).</li>
                    <li>Pastikan "Kamera" dalam posisi Izinkan (Allowed).</li>
                    <li>Segarkan (Refresh) halaman dan coba scan kembali.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <span className="font-bold text-sm text-left">Kendala batas waktu absensi?</span>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                  Tombol absen hanya akan muncul saat jadwal masuk (pagi) atau jadwal pulang (sore) telah dibuka oleh Admin. Jika Anda berada di luar jendela waktu tersebut, aplikasi akan menampilkan pesan "Batas jam masuk berakhir" atau "Belum waktu jam pulang". Pastikan Anda melakukan absen tepat waktu.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <span className="font-bold text-sm text-left">Gagal absen karena masalah lokasi?</span>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                  Aplikasi mewajibkan Anda berada dalam radius sekolah. Jika gagal, pastikan GPS di HP aktif. Cobalah untuk berpindah ke area yang lebih terbuka agar sinyal satelit dapat mengunci posisi Anda dengan lebih akurat.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <span className="font-bold text-sm text-left">Apa saja fitur unggulan lainnya?</span>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-3">
                  <ul className="text-[11px] font-bold text-muted-foreground list-disc pl-4 space-y-1">
                    <li><strong>Laporan PDF</strong>: Unduh riwayat kehadiran pribadi dalam format dokumen resmi.</li>
                    <li><strong>Grafik Statistik</strong>: Pantau performa kehadiran bulanan Anda secara visual.</li>
                    <li><strong>Izin Online</strong>: Ajukan sakit atau izin dinas langsung dari HP tanpa kertas.</li>
                    <li><strong>Kutipan AI</strong>: Dapatkan pesan motivasi unik setiap kali berhasil melakukan absensi.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-none mb-2">
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
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}