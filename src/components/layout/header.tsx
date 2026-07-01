'use client';
import React from 'react';
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
import { LogOut, Settings, ShieldAlert, BookOpen, Clock, QrCode, FileText, UserCircle, TrendingUp } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { ModeToggle } from '@/components/theme-toggle';

export function Header({ isTransparent }: { isTransparent?: boolean }) {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const appLogo = PlaceHolderImages.find(p => p.id === 'app-logo');

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
                    <button className="flex items-center gap-3 focus:outline-none rounded-full p-1 -ml-1 sm:p-0 sm:ml-0">
                        <Avatar className="h-9 w-9 border shadow-sm">
                            <AvatarImage src={currentPhoto ?? undefined} alt="Avatar" />
                            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col justify-center text-left">
                            <p className="text-sm font-medium leading-none">{displayName || 'Pengguna'}</p>
                            <p className="text-[10px] tracking-wide leading-none text-muted-foreground mt-1 font-bold">{displayRole || 'User'}</p>
                        </div>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName || 'Pengguna'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {displayRole || 'User'}
                        </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/pengaturan">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Pengaturan</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Keluar</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
        <ModeToggle />
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full transition-transform active:scale-95">
            <Image
              src={appLogo?.imageUrl || '/logo-3d-v2.png'}
              alt="App Logo"
              width={36}
              height={36}
              priority
              data-ai-hint="app logo"
            />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-primary">
                <BookOpen className="h-6 w-6" />
                <span className="font-bold">Sistem & Alur Kerja E-SPENLI</span>
            </DialogTitle>
            <DialogDescription className="text-left font-medium">
              Panduan lengkap penggunaan fitur aplikasi absensi digital untuk Guru, Pegawai, dan Siswa.
            </DialogDescription>
          </DialogHeader>
          
          <div className="text-sm space-y-6 py-4 pr-2 text-left">
            <section className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <UserCircle className="h-4 w-4 text-primary" />
                    1. Akses & Login
                </div>
                <p className="text-muted-foreground pl-6 leading-relaxed">
                    Masuk menggunakan <strong>Email dan Kata Sandi</strong> yang telah didaftarkan. Pengguna dapat mengubah profil dan sandi secara mandiri di menu Pengaturan. Admin memiliki wewenang untuk mereset sandi jika pengguna mengalami kendala akses.
                </p>
            </section>

            <section className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    2. Beranda (Dashboard)
                </div>
                <p className="text-muted-foreground pl-6 leading-relaxed">
                    Menampilkan jam digital real-time, ringkasan kehadiran hari ini (Jam Masuk/Pulang), serta <strong>Skor Progres Bulanan</strong>. Skor ini menunjukkan pencapaian kehadiran Anda dibandingkan dengan total hari kerja dalam bulan tersebut.
                </p>
            </section>

            <section className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <QrCode className="h-4 w-4 text-primary" />
                    3. Absensi QR Code
                </div>
                <p className="text-muted-foreground pl-6 leading-relaxed">
                    Lakukan scan pada QR Code resmi sekolah. Absensi hanya valid jika Anda berada di dalam <strong>Radius Lokasi Sekolah (GPS)</strong> dan dilakukan pada rentang waktu jam masuk atau jam pulang yang telah ditentukan oleh Admin.
                </p>
            </section>

            <section className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    4. Izin Pribadi & Sakit
                </div>
                <p className="text-muted-foreground pl-6 leading-relaxed">
                    Pengguna dapat mengajukan izin untuk hari ini atau besok. Status pengajuan dapat dipantau langsung (<strong>Menunggu / Disetujui</strong>). Pengajuan yang masih menunggu dapat dibatalkan secara mandiri jika diperlukan.
                </p>
            </section>

            <section className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    5. Laporan & Hitungan Persentase
                </div>
                <div className="text-muted-foreground pl-6 space-y-2 leading-relaxed">
                    <p>Sistem menggunakan perhitungan poin dinamis yang diakumulasikan setiap hari:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs font-bold">
                        <li>Hadir Penuh / Dinas / Pulang Cepat: 1.0 Poin</li>
                        <li>Terlambat: 0.95 Poin</li>
                        <li>Sakit: 0.9 Poin</li>
                        <li>Izin Pribadi: 0.7 Poin</li>
                        <li>Absen Parsial (Masuk/Pulang saja): 0.5 Poin</li>
                    </ul>
                    <p className="text-[11px] italic">Persentase dihitung dari: (Total Poin / Total Hari Kerja Sebulan) x 100%. Skor akan meningkat secara bertahap hingga mencapai 100% pada hari kerja terakhir.</p>
                </div>
            </section>

            <div className="pt-4 border-t border-muted-foreground/10 flex items-start gap-3 bg-primary/5 p-4 rounded-xl">
                <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-primary leading-tight">
                    Seluruh data absensi diverifikasi secara otomatis oleh sistem. Kejujuran adalah tanggung jawab mutlak setiap personil SMPN 5 Langke Rembong.
                </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
