'use client';

import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, addMonths, subMonths, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { TrendingUp, LogIn, LogOut, Sparkles, UserCheck, BookUser, MailWarning, Clock, Lock, AlertCircle, ChevronLeft, ChevronRight, UserX, Calendar, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

import { calculateAttendanceStats, getDailyStaffAttendanceStats } from '@/lib/attendance';
import { useAttendanceWindow } from '@/hooks/use-attendance-window';
import AbsentUsersTable from '@/components/dashboard/AbsentUsersTable';
import RecentAttendanceTable from '@/components/dashboard/RecentAttendanceTable';

const chartConfig = {
  Jumlah: {
    label: "Jumlah",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border shadow-2xl rounded-xl p-4 text-center min-w-[120px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
          <p className="font-semibold text-foreground text-base tracking-tight leading-none">{data.name}</p>
        </div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide">
          {data.Jumlah} hari
        </p>
      </div>
    );
  }
  return null;
};

const LiveClockUI = memo(() => {
    const [time, setTime] = useState<Date | null>(null);
    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!time) return <div className="h-16 w-full flex items-center justify-center"><Skeleton className="h-10 w-40" /></div>;

    return (
        <div className="flex flex-col items-center justify-center py-2 w-full min-h-[80px]" style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}>
            <h2 className="text-5xl font-bold tracking-tighter tabular-nums text-foreground leading-none">
                {format(time, 'HH:mm:ss')}
            </h2>
            <p className="text-xs font-bold text-muted-foreground mt-3 uppercase tracking-wider opacity-60">
                {format(time, 'eeee, d MMMM yyyy', { locale: id })}
            </p>
        </div>
    );
});
LiveClockUI.displayName = 'LiveClockUI';

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { status: windowStatus } = useAttendanceWindow();
  const isMounted = useRef(true);
  const [isClient, setIsClient] = useState(false);

  const [summaryMonth, setSummaryMonth] = useState(new Date());
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false, isManualDisabled: false, isCalendarHoliday: false });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [personalSummary, setPersonalSummary] = useState({ percentage: '0.0', hadir: 0, izin: 0, sakit: 0, alpa: 0 });
  const [isPersonalSummaryLoading, setIsPersonalSummaryLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!firestore || !user?.uid || !isMounted.current) return;
    try {
        const dailyStats = await getDailyStaffAttendanceStats(firestore);
        if (isMounted.current) {
            setStats(dailyStats);
            setIsStatsLoading(false);
        }
    } catch (error) {
        if (isMounted.current) setIsStatsLoading(false);
    }
  }, [firestore, user?.uid]);

  const loadMonthlySummary = useCallback(async (month: Date) => {
      if (!firestore || !user?.uid || !isMounted.current) return;
      setIsPersonalSummaryLoading(true);
      try {
          const personalStats = await calculateAttendanceStats(firestore, user.uid, { 
              start: startOfMonth(month), 
              end: endOfMonth(month) 
          });
          if (isMounted.current) {
              setPersonalSummary({
                  percentage: personalStats.persentase.replace('%', ''),
                  hadir: Math.ceil(personalStats.totalHadir),
                  izin: personalStats.totalIzin,
                  sakit: personalStats.totalSakit,
                  alpa: personalStats.totalAlpa
              });
          }
      } finally {
          if (isMounted.current) setIsPersonalSummaryLoading(false);
      }
  }, [firestore, user?.uid]);

  useEffect(() => {
    isMounted.current = true;
    if (!isUserLoading && user?.uid) {
        loadDashboardData();
        loadMonthlySummary(summaryMonth);
    }
    return () => { isMounted.current = false; };
  }, [loadDashboardData, loadMonthlySummary, summaryMonth, user?.uid, isUserLoading]);

  const todaysAttendanceQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr), limit(1));
  }, [firestore, user]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysAttendanceQuery);

  const todayLeaveQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(
          collection(firestore, 'users', user.uid, 'leaveRequests'),
          where('status', '==', 'approved')
      );
  }, [user, firestore]);
  const { data: activeLeaves, isLoading: isLeaveLoading } = useCollection(user, todayLeaveQuery);

  const currentActiveLeave = useMemo(() => {
      if (!activeLeaves) return null;
      const now = new Date();
      return activeLeaves.find(l => isWithinInterval(now, { start: startOfDay(l.startDate.toDate()), end: endOfDay(l.endDate.toDate()) }));
  }, [activeLeaves]);

  const chartData = useMemo(() => [
    { name: 'Hadir', Jumlah: personalSummary.hadir, color: '#22c55e' },
    { name: 'Sakit', Jumlah: personalSummary.sakit, color: '#f97316' },
    { name: 'Izin', Jumlah: personalSummary.izin, color: '#f59e0b' },
    { name: 'Alpa', Jumlah: personalSummary.alpa, color: '#ef4444' },
  ], [personalSummary]);

  const handlePrevMonth = () => {
    const minDate = new Date(2026, 0, 1);
    setSummaryMonth(prev => {
        const next = subMonths(prev, 1);
        return next < minDate ? prev : next;
    });
  };

  const handleNextMonth = () => {
      setSummaryMonth(prev => addMonths(prev, 1));
  };

  const canGoNext = !isSameMonth(summaryMonth, new Date());
  const canGoPrev = summaryMonth > new Date(2026, 0, 1);

  const navigateToApproval = () => {
    if (user?.role === 'admin') {
        router.push('/dashboard/admin/izin');
    } else if (user?.role === 'kepala_sekolah') {
        router.push('/dashboard/izin-kepala-sekolah');
    }
  };

  const scrollToId = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: elementPosition,
            behavior: 'smooth'
        });
    }
  };

  const renderAttendanceButton = () => {
    const record = todaysAttendance?.[0];
    const isCheckedIn = !!record?.checkInTime;
    const isCheckedOut = !!record?.checkOutTime;
    const isManualFinished = record?.manualEntry && (record?.reasonForUpdate === 'Pulang cepat' || record?.reasonForUpdate === 'Dinas siang');

    const disabledStyle = "w-full bg-primary/10 text-primary/40 border border-primary/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm transition-all cursor-default select-none shadow-none";

    if (windowStatus === 'LOADING' || isAttendanceLoading || isLeaveLoading) {
        return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4 animate-spin" /> Memuat data...</div>;
    }

    if (currentActiveLeave) {
        return (
            <div className="w-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-none">
                <Sparkles className="mr-2 w-4 h-4" /> 
                {currentActiveLeave.type} Disetujui
            </div>
        );
    }

    if (isCheckedOut || isManualFinished) {
        return <div className="w-full bg-green-500/10 text-green-600 border border-green-500/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-none"><Sparkles className="mr-2 w-4 h-4" /> Absensi selesai</div>;
    }

    if (windowStatus === 'DISABLED' || stats.isManualDisabled) {
        return <div className="w-full bg-muted text-muted-foreground border border-border font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-none"><Lock className="mr-2 h-4 w-4" /> Sistem sedang dinonaktifkan</div>;
    }

    if (!isCheckedIn && (windowStatus === 'SESSION_INACTIVE' || stats.isHoliday)) {
        const label = stats.isCalendarHoliday ? 'Hari libur (Kalender)' : 'Hari libur rutin';
        return (
            <div className="w-full bg-muted text-muted-foreground border border-border font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-none">
                <Lock className="mr-2 h-4 w-4" /> {label}
            </div>
        );
    }

    if (windowStatus === 'CHECK_OUT_OPEN') {
        return (
            <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 shadow-none active:scale-95 transition-all bg-blue-600 hover:bg-blue-700 text-white">
                <Link href="/dashboard/absen">Absen pulang sekarang</Link>
            </Button>
        );
    }

    if (!isCheckedIn) {
        if (windowStatus === 'BEFORE_IN') return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4" /> Belum waktu jam masuk</div>;
        if (windowStatus === 'CHECK_IN_OPEN') return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 shadow-none active:scale-95 transition-all"><Link href="/dashboard/absen">Absen masuk sekarang</Link></Button>;
        if (windowStatus === 'AFTER_IN') return <div className="w-full bg-destructive/10 text-destructive/60 border border-destructive/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-none"><AlertCircle className="mr-2 h-4 w-4" /> Batas jam masuk berakhir</div>;
    }

    if (isCheckedIn && !isCheckedOut) {
        if (windowStatus === 'AFTER_IN') return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4" /> Belum waktu jam pulang</div>;
    }

    if (windowStatus === 'CLOSED') {
        return (
            <div className="w-full bg-destructive/10 text-destructive/60 border border-destructive/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-none">
                <AlertCircle className="mr-2 h-4 w-4" /> Waktu absensi hari ini berakhir
            </div>
        );
    }
    
    return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4" /> Menunggu jadwal absensi</div>;
  };

  if (isUserLoading || !isClient) return <div className="w-full space-y-6 animate-pulse p-4"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-48" /></div><div className="pt-10 space-y-4"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-40 w-full rounded-xl" /></div></div>;

  const isAdmin = user?.role === 'admin';
  const isKepsek = user?.role === 'kepala_sekolah';
  const isStaffOnly = ['guru', 'pegawai', 'siswa'].includes(user?.role || '');

  return (
    <div className="w-full space-y-4 pb-10 flex flex-col items-stretch">
        <div className="w-full px-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Selamat datang</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground mt-0.5 leading-tight">{user?.name || 'Pengguna'}</h1>
            <p className="text-sm font-normal text-muted-foreground mt-1">
                {isAdmin ? 'Pantau aktivitas kehadiran hari ini.' : 'Lakukan absensi dan lihat riwayat kehadiran Anda.'}
            </p>
        </div>

        {!isAdmin && (
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
                                <p className="text-[11px] font-medium text-white/80 leading-relaxed">Kelola absensi dan pantau kehadiran Anda dengan mudah.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-card overflow-hidden">
                    <CardContent className="p-8 space-y-6 pt-10 text-center">
                        <LiveClockUI />
                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mx-auto pt-4">
                            <div className="bg-green-500/5 rounded-2xl p-4 text-center border border-green-500/10 flex items-center gap-3 relative overflow-hidden">
                                <div className="absolute right-[-10px] top-[-10px] w-12 h-12 rounded-full bg-green-500/5" />
                                <div className="bg-green-500 p-2.5 rounded-full text-white shadow-lg shadow-green-500/20 shrink-0 relative z-10">
                                    <LogIn className="h-4 w-4" />
                                </div>
                                <div className="text-left relative z-10">
                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none mb-1">Masuk</p>
                                    <p className="text-xl font-bold tabular-nums text-foreground leading-none">
                                        {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--')}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-blue-500/5 rounded-2xl p-4 text-center border border-blue-500/10 flex items-center gap-3 relative overflow-hidden">
                                <div className="absolute right-[-10px] top-[-10px] w-12 h-12 rounded-full bg-blue-500/5" />
                                <div className="bg-blue-500 p-2.5 rounded-full text-white shadow-lg shadow-blue-500/20 shrink-0 relative z-10">
                                    <LogOut className="h-4 w-4" />
                                </div>
                                <div className="text-left relative z-10">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Pulang</p>
                                    <p className="text-xl font-bold tabular-nums text-foreground leading-none">
                                        {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--')}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-stretch gap-3">
                            {renderAttendanceButton()}
                            <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                                <Link href="/dashboard/laporan">Lihat riwayat lengkap</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {(isAdmin || isKepsek) && (
            <div className="w-full space-y-3 pt-2 flex flex-col items-stretch">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                    <Card 
                        className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer group text-white"
                        onClick={() => scrollToId('recent-attendance')}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80 tracking-widest">Hadir</span>
                            <UserCheck className="h-3.5 w-3.5 opacity-60 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.hadir}
                        </div>
                    </Card>
                    <Card 
                        className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer group text-white"
                        onClick={() => scrollToId('absent-users')}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80 tracking-widest">Izin/Sakit</span>
                            <BookUser className="h-3.5 w-3.5 opacity-60 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.izin + stats.sakit}
                        </div>
                    </Card>
                    <Card 
                        className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer group text-white"
                        onClick={navigateToApproval}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80 tracking-widest">Menunggu</span>
                            <MailWarning className="h-3.5 w-3.5 opacity-60 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.pending}
                        </div>
                    </Card>
                    <Card 
                        className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer group text-white"
                        onClick={() => scrollToId('absent-users')}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80 tracking-widest">Alpa</span>
                            <UserX className="h-3.5 w-3.5 opacity-60 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.alpa}
                        </div>
                    </Card>
                </div>
                
                <div id="recent-attendance" className="scroll-mt-20">
                    <RecentAttendanceTable />
                </div>
                
                <div id="absent-users" className="scroll-mt-20">
                    <AbsentUsersTable />
                </div>
            </div>
        )}

        {isStaffOnly && !isAdmin && (
            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl overflow-hidden bg-primary/5 mt-2">
                <CardHeader className="p-6 pb-2 relative z-10 bg-transparent">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-foreground" />
                                <h2 className="text-xl font-bold tracking-tight text-foreground drop-shadow-sm">
                                    Riwayat Bulan {format(summaryMonth, 'MMMM', { locale: id })}
                                </h2>
                            </div>
                            <p className="text-sm font-normal text-muted-foreground">
                                Persentase: {isPersonalSummaryLoading ? '...' : `${personalSummary.percentage}%`}
                            </p>
                        </div>
                        <div className="flex items-center bg-muted/40 rounded-xl border border-muted-foreground/5 p-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shadow-none" onClick={handlePrevMonth} disabled={isPersonalSummaryLoading || !canGoPrev}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shadow-none" onClick={handleNextMonth} disabled={isPersonalSummaryLoading || !canGoNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-6">
                    <div className="w-full h-56 mt-4">
                        {isPersonalSummaryLoading ? (
                            <Skeleton className="h-full w-full rounded-xl" />
                        ) : isClient && (
                            <ChartContainer config={chartConfig} className="h-full w-full">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.2} />
                                    <XAxis dataKey="name" axisLine={{ stroke: 'currentColor', opacity: 0.2 }} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} />
                                    <YAxis axisLine={{ stroke: 'currentColor', opacity: 0.2 }} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05, radius: 8 }} content={<CustomTooltip />} />
                                    <Bar dataKey="Jumlah" radius={[6, 6, 0, 0]} barSize={45}>
                                        {chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        )}
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
