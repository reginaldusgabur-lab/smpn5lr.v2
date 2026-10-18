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
 * Komponen Navigasi Bawah dengan desain Floating Bar yang disesuaikan.
 * Teks menggunakan title-case dan bentuk kartu yang lebih konsisten (rounded-3xl).
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
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-4 px-6">
        {/* Floating container dengan desain rounded-3xl agar rata dengan kartu di dashboard */}
        <div className="w-full max-w-sm h-16 bg-background/80 backdrop-blur-xl border border-border/50 rounded-3xl flex items-stretch shadow-[0_8px_32px_rgba(0,0,0,0.1)] pointer-events-auto overflow-hidden">
            {navItems.map((item) => {
                const isActive = item.href === '/dashboard' 
                    ? pathname === item.href 
                    : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-all duration-300 active:scale-90',
                            isActive ? 'text-primary' : 'text-muted-foreground/70 hover:text-primary'
                        )}
                    >
                        <item.icon className={cn("h-5 w-5 transition-transform", isActive ? "stroke-[2.5px] scale-105" : "stroke-2")} />
                        <span className={cn(
                            "text-center text-[10px] tracking-tight font-bold",
                            isActive ? "opacity-100" : "opacity-80"
                        )}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
