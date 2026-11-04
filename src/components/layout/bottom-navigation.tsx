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
 * Komponen Navigasi Bawah ramping (Slim) dengan desain Bounded Full Bottom.
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
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
        {/* Kontainer lebih ramping (h-14), lengkungan disesuaikan agar tidak terlalu dominan tapi tetap berkarakter */}
        <div className="w-full max-w-md h-14 bg-background border-t border-border/20 rounded-t-[1.8rem] flex items-stretch shadow-[0_-8px_20px_rgba(0,0,0,0.08)] pointer-events-auto overflow-hidden">
            {navItems.map((item) => {
                const isActive = item.href === '/dashboard' 
                    ? pathname === item.href 
                    : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-300 active:scale-90 relative',
                            isActive ? 'text-primary' : 'text-muted-foreground/50'
                        )}
                    >
                        <item.icon className={cn("h-5 w-5 transition-all", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                        <span className={cn(
                            "text-center text-[9px] tracking-tight font-black uppercase",
                            isActive ? "opacity-100" : "opacity-70"
                        )}>
                            {item.label}
                        </span>
                        
                        {/* Indikator titik aktif yang lebih halus */}
                        {isActive && (
                            <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary animate-in fade-in zoom-in duration-500" />
                        )}
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
