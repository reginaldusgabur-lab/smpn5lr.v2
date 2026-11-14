'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, QrCode, FileText, Users, MailCheck, ClipboardCheck, BookCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const defaultNavItems = [
  { href: '/dashboard', icon: Home, label: 'Beranda' },
  { href: '/dashboard/absen', icon: QrCode, label: 'Absen' },
  { href: '/dashboard/izin', icon: MailCheck, label: 'Izin' },
  { href: '/dashboard/laporan', icon: FileText, label: 'Laporan' },
];

const adminNavItems = [
  { href: '/dashboard', icon: Home, label: 'Beranda' },
  { href: '/dashboard/admin/users', icon: Users, label: 'Pengguna' },
  { href: '/dashboard/admin/konfigurasi', icon: QrCode, label: 'Absen' },
  { href: '/dashboard/laporan-sekolah', icon: BookCheck, label: 'Laporan' }, 
];

const headmasterNavItems = [
  { href: '/dashboard', icon: Home, label: 'Beranda' },
  { href: '/dashboard/absen', icon: QrCode, label: 'Absen' },
  { href: '/dashboard/izin-kepala-sekolah', icon: ClipboardCheck, label: 'Persetujuan' },
  { href: '/dashboard/laporan-sekolah', icon: BookCheck, label: 'Laporan' }, 
];

/**
 * Komponen Navigasi Bawah standar (Flat) dengan indikator biru sesuai gambar.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData } = useDoc<{ name: string, role: string }>(user, userDocRef);
  
  const isAdmin = userData?.role === 'admin';
  const isHeadmaster = userData?.role === 'kepala_sekolah';

  let navItems;
  if (isAdmin) {
    navItems = adminNavItems;
  } else if (isHeadmaster) {
    navItems = headmasterNavItems;
  } else {
    navItems = defaultNavItems;
  }

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-background border-t border-border/40">
        <div className="w-full max-w-md h-16 flex items-stretch px-2">
            {navItems.map((item) => {
                const isActive = item.href === '/dashboard' 
                    ? pathname === item.href 
                    : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300 relative',
                            isActive ? 'text-primary' : 'text-muted-foreground/40'
                        )}
                    >
                        <item.icon className={cn("h-6 w-6 transition-all", isActive ? "stroke-[2.5px] fill-primary/10" : "stroke-[2px]")} />
                        <span className={cn(
                            "text-center text-[10px] font-bold tracking-tight",
                            isActive ? "opacity-100" : "opacity-70"
                        )}>
                            {item.label}
                        </span>
                        
                        {/* Indikator titik aktif di bawah ikon sesuai gambar */}
                        {isActive && (
                            <div className="absolute bottom-1 w-1.5 h-0.5 rounded-full bg-primary animate-in fade-in zoom-in duration-500" />
                        )}
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
