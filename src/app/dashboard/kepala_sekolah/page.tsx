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
import { Loader2, CalendarOff, LogIn, LogOut, ClipboardCheck, FileText, UserCheck, UserX, Clock, Calendar, UserCircle, Sparkles } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, limit, getDocs, type DocumentData, collectionGroup } from 'firebase/firestore';
import { format, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getDailyStaffAttendanceStats } from '@/lib/attendance';

function LiveClock() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  useEffect(() => {
    setCurrentTime(new Date());
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);
  return (
      <div className="flex flex-col items-center">
          <h2 className="text-5xl sm:text-6xl font-bold text-foreground tabular-nums tracking-tighter">
              {currentTime ? format(currentTime, 'HH:mm:ss') : '--:--:--'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
              {currentTime ? format(currentTime, 'eeee, d MMMM yyyy', { locale: id }) : 'Memuat tanggal...'}
          </p>
      </div>
  );
}

const KepalaSekolahDashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-48 mt-2" />
        </div>
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
  const { toast } = useToast();
  const isMounted = useRef(true);

  // 1. INSTANT UI: Cache initialization
  const [stats, setStats] = useState(() => {
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('espenli_kepsek_stats');
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
                setStats(daily);
                localStorage.setItem('espenli_kepsek_stats', JSON.stringify(daily));
                setIsStatsLoading(false);
            }
        } catch (e) {
            if (isMounted.current) setIsStatsLoading(false);
        }
    };
    fetchStats();
    return () => { isMounted.current = false; };
  }, [firestore, user, todayStr]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);
  const isHeadmaster = useMemo(() => userData?.role === 'kepala_sekolah', [userData]);
  
  const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
  const { data: schoolConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const todaysPersonalAttendanceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr), limit(1));
  }, [user?.uid, firestore, todayStr]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysPersonalAttendanceQuery);
  
  const usersQuery = useMemoFirebase(() => (isHeadmaster && firestore) ? query(collection(firestore, 'users'), where('status', '==', 'Aktif')) : null, [firestore, isHeadmaster]);
  const { data: usersData } = useCollection(user, usersQuery);

  // 2. REAL-TIME: Snapshot activity
  const globalAttendanceQuery = useMemoFirebase(() => 
    (isHeadmaster && firestore) ? query(
      collectionGroup(firestore, 'attendanceRecords'), 
      where('date', '==', todayStr),
      limit(100)
    ) : null,
    [firestore, isHeadmaster, todayStr]
  );
  const { data: globalAttendance, isLoading: isGlobalLoading } = useCollection(user, globalAttendanceQuery);

  const processedRecentAttendance = useMemo(() => {
    if (!usersData || !globalAttendance) return [];
    const userMap = new Map(usersData.map(u => [u.id, u]));
    
    return [...globalAttendance]
        .sort((a, b) => (a.checkInTime?.toDate().getTime() || 0) - (b.checkInTime?.toDate().getTime() || 0))
        .map((att, index) => {
            const isFinished = !!att.checkOutTime;
            return {
                ...att,
                sequence: index + 1,
                name: userMap.get(att.userId)?.name || 'Pengguna',
                checkInTimeFormatted: att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm:ss') : '-',
                checkOutTimeFormatted: att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm:ss') : '-',
                status: isFinished ? 'Pulang' : 'Hadir',
                statusClass: isFinished ? 'bg-emerald-500' : 'bg-blue-600',
            };
        });
  }, [usersData, globalAttendance]);

  const isLoading = isAuthLoading || isUserDataLoading || isConfigLoading || isAttendanceLoading || (isGlobalLoading && processedRecentAttendance.length === 0);
  
  useEffect(() => {
    if (!isUserDataLoading && user && !isHeadmaster) { router.replace('/dashboard'); }
  }, [isUserDataLoading, isHeadmaster, router, user]);

  if (isLoading || !isHeadmaster) return <KepalaSekolahDashboardSkeleton />;

  const personalButtonAction = () => {
    const record = todaysAttendance?.[0];
    const hasIn = !!record?.checkInTime;
    const hasOut = !!record?.checkOutTime;
    if (hasIn && !hasOut) return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 bg-blue-600"><Link href="/dashboard/absen">Absen Pulang</Link></Button>;
    if (!hasIn) return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12"><Link href="/dashboard/absen">Absen Masuk</Link></Button>;
    return <Button disabled size="lg" className="w-full font-semibold rounded-xl h-12">Absensi Selesai</Button>;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground mt-1">Selamat datang di</p>
        <h1 className="text-2xl font-black tracking-tight text-foreground mt-1 leading-tight">Sistem E-SPENLI</h1>
        <p className="text-[11px] font-bold text-muted-foreground mt-2 leading-relaxed">Dashboard Monitoring Kepala Sekolah.</p>
      </div>

      {stats.isHoliday && (
        <Alert className="bg-blue-50 border-blue-200 rounded-xl shadow-none">
          <CalendarOff className="h-4 w-4 text-blue-600" /><AlertTitle className="text-blue-800 font-bold">Hari Libur Sekolah</AlertTitle><AlertDescription className="text-blue-700 text-xs font-bold">Sistem absensi sedang non-aktif hari ini.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="w-full lg:col-span-2 space-y-1">
            <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl p-0 mb-1 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative">
                <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><UserCircle className="w-24 h-24 text-white" /></div>
                <CardContent className="p-6 relative z-10"><div className="flex items-center gap-4"><div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 shadow-sm backdrop-blur-sm"><Calendar className="h-6 w-6" /></div><div className="space-y-0.5"><h2 className="font-bold text-2xl tracking-tight leading-tight">Kehadiran hari ini</h2><p className="text-[11px] font-medium text-white/80 leading-relaxed">Kelola absensi dan pantau kehadiran pribadi Anda.</p></div></div></CardContent>
            </Card>
            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-primary/5 overflow-hidden">
                <CardContent className="p-8 space-y-6 pt-10 text-center"><LiveClock /><div className="grid grid-cols-2 gap-4 w-full max-sm mx-auto pt-4"><div className="bg-green-500/5 rounded-2xl p-4 text-center border border-green-500/10 flex items-center gap-3 relative overflow-hidden"><div className="bg-green-500 p-2.5 rounded-full text-white shrink-0"><LogIn className="h-4 w-4" /></div><div className="text-left"><p className="text-[10px] font-semibold text-primary leading-none mb-1">Masuk</p><p className="text-xl font-bold tabular-nums text-foreground leading-none">{todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--'}</p></div></div><div className="bg-blue-500/5 rounded-2xl p-4 text-center border border-blue-500/10 flex items-center gap-3 relative overflow-hidden"><div className="bg-blue-500 p-2.5 rounded-full text-white shrink-0"><LogOut className="h-4 w-4" /></div><div className="text-left"><p className="text-[10px] font-semibold text-primary leading-none mb-1">Pulang</p><p className="text-xl font-bold tabular-nums text-foreground leading-none">{todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--'}</p></div></div></div></CardContent>
                <CardFooter className="flex flex-col gap-2 p-6 pt-0">{!stats.isHoliday ? personalButtonAction() : <div className="w-full p-4 bg-muted/30 rounded-xl text-center"><p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Absensi Non-Aktif</p></div>}</CardFooter>
            </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl p-3 text-white">
            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Hadir</span><UserCheck className="h-3.5 w-3.5 opacity-60" /></div>
            <div className="text-3xl font-normal tracking-tight">{stats.hadir}<span className="text-lg opacity-50 ml-1">Staf</span></div>
          </Card>
          <Card className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl p-3 text-white">
            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Persetujuan Izin</span><ClipboardCheck className="h-3.5 w-3.5 opacity-60" /></div>
            <div className="flex items-center justify-between"><div className="text-3xl font-normal tracking-tight">{stats.pending}</div><Button asChild variant="ghost" size="sm" className="h-7 rounded-lg text-[10px] text-white hover:bg-white/10 uppercase tracking-widest">Detail</Button></div>
          </Card>
          <Card className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl p-3 text-white">
            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Alpa</span><UserX className="h-3.5 w-3.5 opacity-60" /></div>
            <div className="text-3xl font-normal tracking-tight">{stats.alpa}</div>
          </Card>
        </div>
      </div>

      <Card className="shadow-none border-muted-foreground/10 overflow-hidden rounded-xl bg-primary/5">
        <CardHeader className="bg-muted/20 border-b border-muted-foreground/5"><CardTitle className="text-lg font-bold">Riwayat Kehadiran Staf Terbaru</CardTitle><CardDescription>Data aktivitas kehadiran guru & pegawai hari ini.</CardDescription></CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-none">
                            <TableHead className="w-[50px] text-center font-bold text-[10px] uppercase tracking-widest">No</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nama</TableHead>
                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Masuk</TableHead>
                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Pulang</TableHead>
                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedRecentAttendance.length > 0 ? processedRecentAttendance.map((item, idx) => (
                            <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                <TableCell className="text-center font-bold text-muted-foreground text-xs">{idx + 1}</TableCell>
                                <TableCell className="font-bold text-sm">{item.name}</TableCell>
                                <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkInTimeFormatted}</TableCell>
                                <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkOutTimeFormatted}</TableCell>
                                <TableCell className="text-center"><Badge variant="outline" className={cn("text-[9px] font-bold uppercase px-3 py-1 rounded-full text-white border-none shadow-none", item.statusClass)}>{item.status}</Badge></TableCell>
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
