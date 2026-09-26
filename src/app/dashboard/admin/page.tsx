'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { UserCheck, Users, FileWarning, ShieldAlert, FileText, CalendarOff, Lock, UserX, BookUser, Clock, Calendar, UserCircle, LogIn, LogOut } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMemo, useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit, getDocs, type DocumentData, collectionGroup, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { startOfDay, endOfDay, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getDailyStaffAttendanceStats } from '@/lib/attendance';
import { cn } from '@/lib/utils';

const AdminDashboardSkeletons = () => (
    <div className="space-y-6">
        <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-48 mt-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
                <Card key={i} className="rounded-xl h-24" />
            ))}
        </div>
        <Card className="rounded-xl h-64" />
    </div>
);

export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);

  const isAdmin = useMemo(() => userData?.role === 'admin', [userData]);

  // 1. Fetch Personal Attendance (Today Only) - VERY EFFICIENT
  const personalAttendanceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'attendanceRecords'), 
      where('date', '==', todayStr), 
      limit(1)
    );
  }, [user?.uid, firestore, todayStr]);
  const { data: personalAttendance } = useCollection(user, personalAttendanceQuery);

  const personalCheckIn = useMemo(() => {
    const rec = personalAttendance?.[0];
    return rec?.checkInTime ? format(rec.checkInTime.toDate(), 'HH:mm') : null;
  }, [personalAttendance]);

  const personalCheckOut = useMemo(() => {
    const rec = personalAttendance?.[0];
    return rec?.checkOutTime ? format(rec.checkOutTime.toDate(), 'HH:mm') : null;
  }, [personalAttendance]);

  // 2. Fetch All Active Users - Memoized
  const allUsersQuery = useMemoFirebase(() => 
    (isAdmin && firestore) ? query(collection(firestore, 'users'), where('status', '==', 'Aktif')) : null, 
    [firestore, isAdmin]
  );
  const { data: usersData, isLoading: isUsersLoading } = useCollection(user, allUsersQuery);
  
  // 3. Fetch Today's Global Attendance (Using collectionGroup with strict date filter)
  // CRITICAL: Filter where('date', '==', todayStr) to prevent reading entire database
  const globalAttendanceQuery = useMemoFirebase(() => 
    (isAdmin && firestore) ? query(
      collectionGroup(firestore, 'attendanceRecords'), 
      where('date', '==', todayStr),
      limit(100) // Safety limit for dashboard
    ) : null,
    [firestore, isAdmin, todayStr]
  );
  const { data: globalAttendance, isLoading: isGlobalLoading } = useCollection(user, globalAttendanceQuery);

  // 4. Fetch Pending Leaves Only
  const pendingLeaveQuery = useMemoFirebase(() => 
    (isAdmin && firestore) ? query(
      collectionGroup(firestore, 'leaveRequests'), 
      where('status', '==', 'pending'),
      limit(50)
    ) : null,
    [firestore, isAdmin]
  );
  const { data: pendingLeaves, isLoading: isLeavesLoading } = useCollection(user, pendingLeaveQuery);

  const stats = useMemo(() => {
    if (!usersData || !globalAttendance) return { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0 };
    
    const presentIds = new Set(globalAttendance.map(a => a.userId));
    const totalStaff = usersData.filter(u => ['guru', 'pegawai', 'kepala_sekolah'].includes(u.role)).length;
    
    return {
        hadir: presentIds.size,
        izin: 0, // Calculated separately if needed
        sakit: 0,
        pending: pendingLeaves?.length || 0,
        alpa: Math.max(0, totalStaff - presentIds.size)
    };
  }, [usersData, globalAttendance, pendingLeaves]);

  const recentUserActivity = useMemo(() => {
    if (!usersData || !globalAttendance) return [];
    const userMap = new Map(usersData.map(u => [u.id, u]));
    
    return [...globalAttendance]
        .sort((a, b) => {
            const timeA = a.checkInTime?.toDate().getTime() || a.checkOutTime?.toDate().getTime() || 0;
            const timeB = b.checkInTime?.toDate().getTime() || b.checkOutTime?.toDate().getTime() || 0;
            return timeB - timeA;
        })
        .slice(0, 10) // Only show top 10 for dashboard efficiency
        .map((att, index) => {
            const userDoc = userMap.get(att.userId);
            const isFinished = !!att.checkOutTime;
            return {
                ...att,
                sequence: index + 1,
                name: userDoc?.name || 'Pengguna',
                role: (userDoc?.role || 'user').replace('_', ' '),
                checkInTimeFormatted: att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm:ss') : '-',
                checkOutTimeFormatted: att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm:ss') : '-',
                status: isFinished ? 'Pulang' : 'Hadir',
                statusClass: isFinished ? 'bg-emerald-500' : 'bg-blue-600',
            };
        });
  }, [usersData, globalAttendance]);

  const isRoleCheckLoading = isUserLoading || isUserDataLoading;

  useEffect(() => {
    if (!isRoleCheckLoading) {
      if (!user) { router.replace('/'); } 
      else if (!isAdmin) { router.replace('/dashboard'); }
    }
  }, [isRoleCheckLoading, user, isAdmin, router]);

  if (isRoleCheckLoading || isUsersLoading || isGlobalLoading || isLeavesLoading) {
    return <AdminDashboardSkeletons />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground mt-1">Selamat datang di</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground mt-1 leading-tight">Sistem E-SPENLI</h1>
          <p className="text-xs font-bold text-muted-foreground mt-2">Dashboard Administratif.</p>
      </div>
      
       <div className="grid gap-6">
        {/* Real-time Clock Card */}
        <div className="w-full space-y-1">
            <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl p-0 mb-1 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative">
                <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12">
                    <UserCircle className="w-24 h-24 text-white" />
                </div>
                <CardContent className="p-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div className="space-y-0.5">
                            <h2 className="font-bold text-2xl tracking-tight leading-tight">Kehadiran hari ini</h2>
                            <p className="text-[11px] font-medium text-white/80 leading-relaxed">Pantauan kehadiran personil secara real-time.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-primary/5 overflow-hidden">
                <CardContent className="p-8 space-y-6 pt-10 text-center">
                    <div className="flex flex-col items-center justify-center">
                        <h2 className="text-5xl font-bold tracking-tighter tabular-nums text-foreground leading-none">
                            {format(currentTime, 'HH:mm:ss')}
                        </h2>
                        <p className="text-xs font-medium text-muted-foreground mt-2 opacity-60">
                            {format(currentTime, 'eeee, d MMMM yyyy', { locale: id })}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full max-sm mx-auto pt-4">
                        <div className="bg-green-500/5 rounded-2xl p-4 text-center border border-green-500/10 flex items-center gap-3 relative overflow-hidden">
                            <div className="bg-green-500 p-2.5 rounded-full text-white shadow-lg shrink-0">
                                <LogIn className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-semibold text-primary leading-none mb-1">Masuk</p>
                                <p className="text-xl font-bold tabular-nums text-foreground leading-none">{personalCheckIn || '--:--'}</p>
                            </div>
                        </div>
                        <div className="bg-blue-500/5 rounded-2xl p-4 text-center border border-blue-500/10 flex items-center gap-3 relative overflow-hidden">
                            <div className="bg-blue-500 p-2.5 rounded-full text-white shadow-lg shrink-0">
                                <LogOut className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-semibold text-primary leading-none mb-1">Pulang</p>
                                <p className="text-xl font-bold tabular-nums text-foreground leading-none">{personalCheckOut || '--:--'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <Card className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Hadir</span>
                    <UserCheck className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">{stats.hadir}</div>
            </Card>

            <Card className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Izin/Sakit</span>
                    <BookUser className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">{stats.izin + stats.sakit}</div>
            </Card>

            <Card className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-xl p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Menunggu</span>
                    <Clock className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">{stats.pending}</div>
            </Card>

            <Card className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Alpa</span>
                    <UserX className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">{stats.alpa}</div>
            </Card>
        </div>

        <Card className="shadow-none overflow-hidden border-muted-foreground/10 bg-primary/5 rounded-xl">
            <CardHeader className="bg-muted/20 border-b border-muted-foreground/5">
                <CardTitle className="text-lg font-bold">Aktivitas Kehadiran Terbaru</CardTitle>
                <CardDescription>Maksimal 10 aktivitas terbaru hari ini.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-none">
                                <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase tracking-widest">No</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nama Personil</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Masuk</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-center">Pulang</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentUserActivity.length > 0 ? recentUserActivity.map((item, idx) => (
                                <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                    <TableCell className="text-center font-bold text-muted-foreground text-sm">{idx + 1}</TableCell>
                                    <TableCell>
                                        <div className="font-bold text-sm">{item.name}</div>
                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">{item.role}</div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkInTimeFormatted}</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkOutTimeFormatted}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("text-[9px] font-bold uppercase text-white border-none px-3 py-1 rounded-full", item.statusClass)}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest opacity-40">Belum ada aktivitas hari ini.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
