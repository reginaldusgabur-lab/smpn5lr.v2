'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarOff, LogIn, LogOut, ClipboardCheck, FileText, UserCheck, UserX, Clock, Calendar, UserCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, limit, collectionGroup } from 'firebase/firestore';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getDailyStaffAttendanceStats } from '@/lib/attendance';

function LiveClock() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
      <div className="flex flex-col items-center">
          <h2 className="text-5xl sm:text-6xl font-bold text-foreground tabular-nums tracking-tighter">
              {currentTime ? format(currentTime, 'HH:mm:ss') : '--:--:--'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
              {currentTime ? format(currentTime, 'eeee, d MMMM yyyy', { locale: id }) : '...'}
          </p>
      </div>
  );
}

const KepalaSekolahDashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
            <Card className="w-full lg:col-span-2 rounded-xl h-64" />
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Card key={i} className="h-24 rounded-xl" />)}
            </div>
        </div>
    </div>
);

export default function KepalaSekolahDashboardPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isMounted = useRef(true);

  const [stats, setStats] = useState(() => {
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('espenli_kepsek_stats_v2');
        return cached ? JSON.parse(cached) : { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false };
    }
    return { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false };
  });

  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    isMounted.current = true;
    if (!firestore || !user) return;
    const fetchStats = async () => {
        try {
            const daily = await getDailyStaffAttendanceStats(firestore);
            if (isMounted.current) {
                setStats(daily as any);
                localStorage.setItem('espenli_kepsek_stats_v2', JSON.stringify(daily));
                setIsStatsLoading(false);
            }
        } catch (e) { if (isMounted.current) setIsStatsLoading(false); }
    };
    fetchStats();
    return () => { isMounted.current = false; };
  }, [firestore, user, todayStr]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);
  const isHeadmaster = userData?.role === 'kepala_sekolah';
  
  const attendanceQuery = useMemoFirebase(() => 
    (isHeadmaster && firestore) ? query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr), limit(100)) : null,
    [firestore, isHeadmaster, todayStr]
  );
  const { data: globalAttendance, isLoading: isGlobalLoading } = useCollection(user, attendanceQuery);

  const usersQuery = useMemoFirebase(() => (isHeadmaster && firestore) ? query(collection(firestore, 'users'), where('status', '==', 'Aktif')) : null, [firestore, isHeadmaster]);
  const { data: usersData } = useCollection(user, usersQuery);

  const processedRecentAttendance = useMemo(() => {
    if (!usersData || !globalAttendance) return [];
    const userMap = new Map(usersData.map(u => [u.id, u]));
    return [...globalAttendance]
        .sort((a, b) => (a.checkInTime?.toDate().getTime() || 0) - (a.checkInTime?.toDate().getTime() || 0))
        .map((att, index) => {
            const u = userMap.get(att.userId);
            const isOut = !!att.checkOutTime;
            return {
                ...att,
                sequence: index + 1,
                name: u?.name || 'Pengguna',
                in: att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm:ss') : '-',
                out: att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm:ss') : '-',
                status: isOut ? 'Pulang' : 'Hadir',
                statusClass: isOut ? 'bg-emerald-500' : 'bg-blue-600',
            };
        }).reverse();
  }, [usersData, globalAttendance]);

  const todaysPersonalAttendanceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'attendanceRecords'),
      where('date', '==', todayStr),
      limit(1)
    );
  }, [user?.uid, firestore, todayStr]);
  const { data: todaysAttendance } = useCollection(user, todaysPersonalAttendanceQuery);

  useEffect(() => {
    if (!isUserDataLoading && user && !isHeadmaster) router.replace('/dashboard');
  }, [isUserDataLoading, isHeadmaster, router, user]);

  if (isUserDataLoading || isGlobalLoading) {
    return <KepalaSekolahDashboardSkeleton />;
  }

  const personalButtonAction = () => {
    const record = todaysAttendance?.[0];
    const hasIn = !!record?.checkInTime;
    const hasOut = !!record?.checkOutTime;

    if (hasIn && !hasOut) {
        return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 active:scale-95 transition-all"><Link href="/dashboard/absen">Absen Pulang</Link></Button>;
    } else if (!hasIn) {
        return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 active:scale-95 transition-all"><Link href="/dashboard/absen">Absen Masuk</Link></Button>;
    } else {
        return <Button disabled size="lg" className="w-full font-semibold rounded-xl h-12 active:scale-95 transition-all">Absensi Selesai</Button>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground mt-1">Selamat datang di</p>
        <h1 className="text-2xl font-black tracking-tight text-foreground mt-1 leading-tight">Sistem E-SPENLI</h1>
        <p className="text-[11px] font-bold text-muted-foreground mt-2 uppercase tracking-widest">Dashboard Kepala Sekolah</p>
      </div>

      {stats.isHoliday && (
        <Card className="bg-blue-50 border-blue-200 rounded-xl overflow-hidden p-4 flex items-center gap-3">
          <CalendarOff className="h-5 w-5 text-blue-600" /><p className="text-xs font-black text-blue-800 uppercase tracking-widest">Absensi Non-Aktif Hari Ini</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="w-full lg:col-span-2 space-y-1">
            <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl p-0 mb-1 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative">
                <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><UserCircle className="w-24 h-24 text-white" /></div>
                <CardContent className="p-6 relative z-10"><div className="flex items-center gap-4"><div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm"><Calendar className="h-6 w-6" /></div><div className="space-y-0.5"><h2 className="font-bold text-2xl tracking-tight leading-tight">Kehadiran Hari Ini</h2><p className="text-[11px] font-medium text-white/80 leading-relaxed">Kelola absensi dan pantau aktivitas personil.</p></div></div></CardContent>
            </Card>
            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-primary/5 overflow-hidden">
                <CardContent className="p-8 space-y-6 text-center"><LiveClock /></CardContent>
                <CardFooter className="flex flex-col gap-2 p-6 pt-0"><Button asChild size="lg" className="w-full font-bold rounded-xl h-12 shadow-none"><Link href="/dashboard/absen">Buka Panel Absensi</Link></Button></CardFooter>
            </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest">Hadir</span><UserCheck className="h-3.5 w-3.5 opacity-60" /></div><div className="text-3xl font-normal tracking-tight">{stats.hadir}</div></Card>
          <Card className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest">Persetujuan</span><ClipboardCheck className="h-3.5 w-3.5 opacity-60" /></div><div className="flex items-center justify-between"><div className="text-3xl font-normal tracking-tight">{stats.pending}</div><Button asChild variant="ghost" size="sm" className="h-7 text-white hover:bg-white/10 text-[10px] tracking-widest">Detail</Button></div></Card>
          <Card className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest">Alpa</span><UserX className="h-3.5 w-3.5 opacity-60" /></div><div className="text-3xl font-normal tracking-tight">{stats.alpa}</div></Card>
        </div>
      </div>

      <Card className="shadow-none border-muted-foreground/10 overflow-hidden rounded-xl bg-primary/5">
        <CardHeader className="bg-muted/20 border-b border-muted-foreground/5 flex flex-row items-center justify-between"><div className="space-y-1"><CardTitle className="text-lg font-bold">Riwayat Harian Staf</CardTitle><CardDescription>Aktivitas absensi terbaru hari ini.</CardDescription></div><Button variant="ghost" size="icon" onClick={() => router.refresh()} className="rounded-full"><RefreshCw className="h-4 w-4" /></Button></CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30"><TableRow className="border-none"><TableHead className="w-[50px] text-center font-bold text-[10px] tracking-widest">No</TableHead><TableHead className="font-bold text-[10px] tracking-widest">Nama</TableHead><TableHead className="text-center font-bold text-[10px] tracking-widest">Masuk</TableHead><TableHead className="text-center font-bold text-[10px] tracking-widest">Pulang</TableHead><TableHead className="text-center font-bold text-[10px] tracking-widest">Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {processedRecentAttendance.length > 0 ? processedRecentAttendance.map((item, idx) => (
                            <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                <TableCell className="text-center font-bold text-muted-foreground text-xs">{idx + 1}</TableCell>
                                <TableCell className="font-bold text-sm">{item.name}</TableCell>
                                <TableCell className="text-center font-mono text-xs font-bold">{item.in}</TableCell>
                                <TableCell className="text-center font-mono text-xs font-bold">{item.out}</TableCell>
                                <TableCell className="text-center"><Badge variant="outline" className={cn("text-[9px] font-bold px-3 py-1 rounded-full text-white border-none", item.statusClass)}>{item.status}</Badge></TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest opacity-40">Belum ada aktivitas hari ini.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
