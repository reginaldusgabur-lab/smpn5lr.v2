'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { PlaceHolderImages } from '@/lib/placeholder-images';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Settings, 
  ShieldAlert, 
  BookOpen, 
  UserCircle, 
  TrendingUp, 
  QrCode, 
  FileText, 
  Zap, 
  AlertTriangle, 
  Power, 
  HelpCircle,
  CheckCircle2,
  Info,
  MapPin,
  Lock
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary/5 p-8 border-b border-muted-foreground/10">
            <DialogHeader>
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight text-primary uppercase">E-SPENLI FAQ</DialogTitle>
                  <DialogDescription className="font-bold text-xs text-muted-foreground uppercase tracking-widest">
                    Pusat Bantuan & Panduan Pengguna
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="p-6 sm:p-8 space-y-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <div className="flex items-center gap-3 text-left">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-sm">Apa itu aplikasi E-SPENLI?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                  E-SPENLI adalah sistem absensi digital modern yang dirancang khusus untuk SMPN 5 Langke Rembong. Aplikasi ini bertujuan untuk meningkatkan kedisiplinan, akurasi data kehadiran, dan transparansi laporan bagi seluruh warga sekolah.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <div className="flex items-center gap-3 text-left">
                    <QrCode className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-sm">Bagaimana cara melakukan absensi?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl space-y-3">
                  <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                    1. Masuk ke halaman <strong>Absen</strong>.<br/>
                    2. Izinkan aplikasi mengakses kamera HP Anda.<br/>
                    3. Arahkan kamera ke QR Code resmi yang disediakan sekolah.<br/>
                    4. Tunggu hingga muncul notifikasi sukses berwarna hijau.
                  </p>
                  <div className="p-3 bg-amber-500/10 rounded-xl flex gap-3">
                    <Zap className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-[10px] font-bold text-amber-700">Tips: Buka aplikasi 5 menit sebelum sampai sekolah agar data ter-load lebih cepat saat proses scan.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <div className="flex items-center gap-3 text-left">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-sm">Gagal absen karena masalah lokasi?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                  Pastikan <strong>GPS/Layanan Lokasi</strong> di HP Anda sudah aktif dengan akurasi tinggi. Jika masih gagal, cobalah untuk keluar sejenak ke tempat yang lebih terbuka (tidak terhalang bangunan beton tebal) agar sinyal satelit GPS lebih kuat mengunci posisi Anda dalam radius sekolah.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <div className="flex items-center gap-3 text-left">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-sm">Bagaimana cara mengajukan izin/sakit?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                  Gunakan menu <strong>Izin</strong>. Pilih tanggal (Hari ini atau Besok), tentukan kategori (Sakit/Izin/Dinas), dan tuliskan alasan yang jelas. Admin atau Kepala Sekolah akan meninjau pengajuan Anda. Status persetujuan dapat dilihat secara real-time di halaman Laporan.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-none mb-2">
                <AccordionTrigger className="hover:no-underline p-4 bg-muted/30 rounded-2xl transition-all data-[state=open]:rounded-b-none data-[state=open]:bg-primary/5">
                  <div className="flex items-center gap-3 text-left">
                    <Lock className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-sm">Bagaimana jika saya lupa kata sandi?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-primary/5 rounded-b-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                  Demi keamanan, Anda disarankan untuk segera menghubungi <strong>Administrator Sistem</strong> di kantor sekolah untuk dilakukan reset kata sandi secara manual. Setelah mendapatkan sandi baru, segera ganti dengan sandi pribadi Anda di menu Pengaturan.
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
