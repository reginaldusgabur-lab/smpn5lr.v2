'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserCheck, BookUser, MailWarning, Clock, UserX, Calendar, UserCircle, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMemo, useEffect, useState, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit, collectionGroup } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getDailyStaffAttendanceStats } from '@/lib/attendance';
import { cn } from '@/lib/utils';

const AdminDashboardSkeletons = () => (
    <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Card key={i} className="h-24 rounded-xl" />)}
        </div>
        <Card className="h-64 rounded-xl" />
    </div>
);

export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isMounted = useRef(true);

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [stats, setStats] = useState(() => {
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('espenli_admin_stats_v2');
        return cached ? JSON.parse(cached) : { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false };
    }
    return { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false };
  });

  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (!firestore || !user) return;
    const fetchStats = async () => {
        try {
            const daily = await getDailyStaffAttendanceStats(firestore);
            if (isMounted.current) {
                setStats(daily);
                localStorage.setItem('espenli_admin_stats_v2', JSON.stringify(daily));
                setIsStatsLoading(false);
            }
        } catch (e) { if (isMounted.current) setIsStatsLoading(false); }
    };
    fetchStats();
    return () => { isMounted.current = false; };
  }, [firestore, user, todayStr]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);
  const isAdmin = userData?.role === 'admin';

  const attendanceQuery = useMemoFirebase(() => 
    (isAdmin && firestore) ? query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr), limit(100)) : null,
    [firestore, isAdmin, todayStr]
  );
  const { data: globalAttendance, isLoading: isGlobalLoading } = useCollection(user, attendanceQuery);

  const usersQuery = useMemoFirebase(() => (isAdmin && firestore) ? query(collection(firestore, 'users'), where('status', '==', 'Aktif')) : null, [firestore, isAdmin]);
  const { data: usersData } = useCollection(user, usersQuery);

  const recentUserActivity = useMemo(() => {
    if (!usersData || !globalAttendance) return [];
    const userMap = new Map(usersData.map(u => [u.id, u]));
    return [...globalAttendance]
        .sort((a, b) => (a.checkInTime?.toDate().getTime() || 0) - (b.checkInTime?.toDate().getTime() || 0))
        .map((att, idx) => {
            const u = userMap.get(att.userId);
            const isOut = !!att.checkOutTime;
            return {
                ...att,
                name: u?.name || 'Pengguna',
                role: (u?.role || 'user').replace('_', ' '),
                in: att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm:ss') : '-',
                out: att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm:ss') : '-',
                status: isOut ? 'Pulang' : 'Hadir',
                statusClass: isOut ? 'bg-emerald-500' : 'bg-blue-600',
            };
        }).reverse();
  }, [usersData, globalAttendance]);

  useEffect(() => {
    if (!isUserDataLoading && user && !isAdmin) router.replace('/dashboard');
  }, [isUserDataLoading, isAdmin, router, user]);

  if (isUserDataLoading || (isGlobalLoading && recentUserActivity.length === 0)) return <AdminDashboardSkeletons />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground mt-1">Selamat datang di</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground mt-1 leading-tight">Sistem E-SPENLI</h1>
          <p className="text-xs font-bold text-muted-foreground mt-2 uppercase tracking-widest">Dashboard Admin Utama</p>
      </div>
      
       <div className="grid gap-6">
        <div className="w-full space-y-1">
            <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl p-0 mb-1 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative">
                <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><UserCircle className="w-24 h-24 text-white" /></div>
                <CardContent className="p-6 relative z-10"><div className="flex items-center gap-4"><div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 shadow-sm backdrop-blur-sm"><Calendar className="h-6 w-6" /></div><div className="space-y-0.5"><h2 className="font-bold text-2xl tracking-tight leading-tight">Kehadiran hari ini</h2><p className="text-[11px] font-medium text-white/80 leading-relaxed">Pantauan aktivitas personil secara real-time.</p></div></div></CardContent>
            </Card>

            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-primary/5 overflow-hidden">
                <CardContent className="p-8 space-y-2 text-center">
                    <h2 className="text-5xl font-bold tracking-tighter tabular-nums text-foreground leading-none">{currentTime ? format(currentTime, 'HH:mm:ss') : '--:--:--'}</h2>
                    <p className="text-xs font-medium text-muted-foreground opacity-60">{currentTime ? format(currentTime, 'eeee, d MMMM yyyy', { locale: id }) : '...'}</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <Card className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Hadir</span><UserCheck className="h-3.5 w-3.5 opacity-60" /></div><div className="text-3xl font-normal tracking-tight">{stats.hadir}</div></Card>
            <Card className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Izin/Sakit</span><BookUser className="h-3.5 w-3.5 opacity-60" /></div><div className="text-3xl font-normal tracking-tight">{stats.izin + stats.sakit}</div></Card>
            <Card className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Menunggu</span><Clock className="h-3.5 w-3.5 opacity-60" /></div><div className="text-3xl font-normal tracking-tight">{stats.pending}</div></Card>
            <Card className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl p-3 text-white"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-normal opacity-80 tracking-widest uppercase">Alpa</span><UserX className="h-3.5 w-3.5 opacity-60" /></div><div className="text-3xl font-normal tracking-tight">{stats.alpa}</div></Card>
        </div>

        <Card className="shadow-none overflow-hidden border-muted-foreground/10 bg-primary/5 rounded-xl">
            <CardHeader className="bg-muted/20 border-b border-muted-foreground/5 flex flex-row items-center justify-between"><div className="space-y-1"><CardTitle className="text-lg font-bold">Aktivitas Terbaru</CardTitle><CardDescription>Data kehadiran yang tercatat hari ini.</CardDescription></div><Button variant="ghost" size="icon" onClick={() => router.refresh()} className="rounded-full"><RefreshCw className="h-4 w-4" /></Button></CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-none">
                                <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase">No</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase">Nama & Peran</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase">Masuk</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase">Pulang</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentUserActivity.length > 0 ? recentUserActivity.map((item, idx) => (
                                <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                    <TableCell className="text-center font-bold text-muted-foreground text-sm">{idx + 1}</TableCell>
                                    <TableCell><div className="font-bold text-sm">{item.name}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">{item.role}</div></TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold">{item.in}</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold">{item.out}</TableCell>
                                    <TableCell className="text-center"><Badge variant="outline" className={cn("text-[9px] font-bold uppercase text-white border-none px-3 py-1 rounded-full", item.statusClass)}>{item.status}</Badge></TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold text-xs tracking-widest opacity-40 uppercase">Belum ada aktivitas</TableCell></TableRow>
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
