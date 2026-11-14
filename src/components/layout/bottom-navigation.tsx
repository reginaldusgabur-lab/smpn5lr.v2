
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
 * Komponen Navigasi Bawah dengan transisi gaya ikon dari Outline ke Solid Blue.
 * Menempel penuh di bawah layar (Full Width) dengan indikator aktif yang tegas.
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
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <div className="flex h-16 items-stretch w-full max-w-full">
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
                        <item.icon 
                            className={cn(
                                "h-6 w-6 transition-all duration-300 ease-in-out transform", 
                                isActive ? "fill-primary stroke-primary scale-110" : "fill-none stroke-current"
                            )} 
                            strokeWidth={isActive ? 2.5 : 1.5}
                        />
                        <span className={cn(
                            "text-center text-[10px] font-black tracking-tight transition-all duration-300",
                            isActive ? "opacity-100 translate-y-0" : "opacity-60 translate-y-0.5"
                        )}>
                            {item.label}
                        </span>
                        
                        {/* Indikator titik aktif di bawah teks */}
                        {isActive && (
                            <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary animate-in fade-in zoom-in duration-500" />
                        )}
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
