'use client';
import React from 'react';
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
  Settings, 
  UserCircle, 
  Power, 
  HelpCircle
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { ModeToggle } from '@/components/theme-toggle';
import { NetworkStatusDot } from './NetworkStatusDot';
import { cn } from '@/lib/utils';

export function Header({ isTransparent }: { isTransparent?: boolean }) {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

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

  // REFACTORED: Use sticky instead of fixed to align naturally with parent content area
  const headerClasses = cn(
    "sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-background/95 backdrop-blur-md px-4 sm:px-6 transition-all duration-300",
    isTransparent ? "opacity-0 pointer-events-none" : "opacity-100"
  );

  return (
    <header className={headerClasses}>
      {/* Left: User Profile Dropdown */}
      <div className="flex items-center gap-3 min-w-0 max-w-[65%]">
        {isProfileLoading && !displayName ? (
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="hidden sm:flex flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
        ) : (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 focus:outline-none rounded-full p-0.5 group min-w-0 overflow-hidden">
                        <Avatar className="h-9 w-9 border border-primary/10 shadow-sm shrink-0 transition-transform group-active:scale-95">
                            <AvatarImage src={currentPhoto ?? undefined} alt="Avatar" className="object-cover" />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col justify-center text-left min-w-0 overflow-hidden pr-2">
                            <p className="text-sm font-bold leading-none tracking-tight truncate">{displayName || 'Pengguna'}</p>
                            <p className="text-[10px] tracking-widest leading-none text-muted-foreground mt-1.5 font-bold uppercase opacity-60 truncate">{displayRole || 'User'}</p>
                        </div>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
                    <DropdownMenuLabel className="font-normal px-4 py-4">
                        <div className="flex items-center gap-3">
                            <UserCircle className="h-5 w-5 text-primary opacity-40" />
                            <div className="flex flex-col space-y-1 min-w-0">
                                <p className="text-sm font-bold leading-none text-primary truncate">{displayName || 'Pengguna'}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
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
                        onClick={() => router.push('/dashboard/bantuan')}
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
      </div>

      {/* Right: Actions & Logo */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <ModeToggle />
        <NetworkStatusDot />
        <button onClick={() => router.push('/dashboard/bantuan')} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full transition-transform active:scale-95">
          <Image
            src="/logo-3d.png"
            alt="App Logo"
            width={32}
            height={32}
            className="sm:w-9 sm:h-9"
            priority
          />
        </button>
      </div>
    </header>
  );
}
