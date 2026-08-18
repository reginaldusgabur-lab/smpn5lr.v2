'use client';

import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useUser, useDoc, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, addMonths, subMonths, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { LogIn, LogOut, Sparkles, User, Clock, AlertCircle, ChevronLeft, ChevronRight, CalendarDays, UserX, BookUser, MailWarning, CheckCircle2, Loader2, CalendarOff, Lock, TrendingUp, CalendarCheck } from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center py-2 w-full" style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}>
            <h2 className="text-4xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white leading-none">
                {format(time, 'HH:mm:ss')}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-normal opacity-70">
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
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
  };

  const renderAttendanceButton = () => {
    const record = todaysAttendance?.[0];
    const isCheckedIn = !!record?.checkInTime;
    const isCheckedOut = !!record?.checkOutTime;

    if (windowStatus === 'LOADING' || isAttendanceLoading || isLeaveLoading) {
        return (
            <div className="w-full bg-muted/20 border border-border/50 rounded-xl h-14 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Memeriksa status...</span>
            </div>
        );
    }

    if (stats.isManualDisabled || windowStatus === 'DISABLED') {
         return (
            <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-14 flex items-center justify-center gap-3">
                <Lock className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">Sistem dinonaktifkan</span>
            </div>
        );
    }

    if (stats.isHoliday || windowStatus === 'SESSION_INACTIVE') {
         const label = stats.isCalendarHoliday ? 'Hari libur (Kalender)' : 'Hari libur rutin';
         return (
            <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-14 flex items-center justify-center gap-3">
                <CalendarOff className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{label}</span>
            </div>
        );
    }

    if (currentActiveLeave) {
        return (
            <div className="w-full bg-blue-50 border border-blue-100 rounded-xl h-14 flex items-center justify-center gap-3">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight">{currentActiveLeave.type} Disetujui</span>
            </div>
        );
    }

    if (isCheckedOut) {
        return (
            <div className="w-full bg-green-50 border border-green-100 rounded-xl h-14 flex items-center justify-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-[11px] font-black text-green-600 uppercase tracking-tight">Absensi hari ini tuntas</span>
            </div>
        );
    }

    if (windowStatus === 'CHECK_OUT_OPEN') {
        return (
            <Button asChild className="w-full h-14 rounded-2xl bg-[#007aff] hover:bg-[#007aff]/90 text-white font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-sm">
                <Link href="/dashboard/absen">Absen pulang sekarang</Link>
            </Button>
        );
    }

    if (!isCheckedIn) {
        if (windowStatus === 'BEFORE_IN') {
            return (
                <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-14 flex items-center justify-center gap-3">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-tight">Belum jam masuk</span>
                </div>
            );
        }
        if (windowStatus === 'CHECK_IN_OPEN') {
            return (
                <Button asChild className="w-full h-14 rounded-2xl bg-[#007aff] hover:bg-[#007aff]/90 text-white font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-sm">
                    <Link href="/dashboard/absen">Absen masuk sekarang</Link>
                </Button>
            );
        }
        return (
            <div className="w-full bg-[#fef2f2] border border-red-100 rounded-2xl h-14 flex items-center justify-center gap-3 shadow-none">
                <div className="bg-white rounded-full p-1.5 border border-red-200 shadow-sm">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                </div>
                <span className="text-[12px] font-bold text-red-600 tracking-tight">Batas jam masuk berakhir</span>
            </div>
        );
    } else {
        return (
            <div className="w-full bg-blue-50 border border-blue-100 rounded-xl h-14 flex items-center justify-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight">Sudah absen masuk</span>
            </div>
        );
    }
  };

  if (isUserLoading || !isClient) return <div className="w-full space-y-6 animate-pulse p-4"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-48" /></div><div className="pt-10 space-y-4"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-40 w-full rounded-xl" /></div></div>;

  const isAdmin = user?.role === 'admin';
  const isKepsek = user?.role === 'kepala_sekolah';
  const isStaffOnly = ['guru', 'pegawai', 'siswa'].includes(user?.role || '');

  return (
    <div className="w-full space-y-6 pb-20 flex flex-col items-stretch max-w-2xl mx-auto">
        <div className="w-full px-0 space-y-0.5">
            <p className="text-xs font-bold text-muted-foreground">Selamat datang</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground leading-tight">{user?.name || 'Pengguna'}</h1>
            <p className="text-xs font-bold text-muted-foreground/60 mt-1">
                {isAdmin ? 'Pantau aktivitas kehadiran hari ini.' : 'Lakukan absensi dan lihat riwayat kehadiran Anda.'}
            </p>
        </div>

        {!isAdmin && (
            <div className="w-full space-y-4">
                <Card className="w-full border-none shadow-none rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 overflow-hidden relative">
                    <CardContent className="p-6 flex items-center gap-5 text-white">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                            <CalendarDays className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex flex-col gap-0.5 relative z-10">
                            <h2 className="text-xl font-bold tracking-tight leading-tight">Kehadiran hari ini</h2>
                            <p className="text-[10px] font-medium text-white/80">Kelola absensi dan pantau kehadiran Anda dengan mudah.</p>
                        </div>
                        <div className="absolute top-1/2 -right-4 -translate-y-1/2 opacity-10">
                            <User className="h-24 w-24" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full border-none shadow-[0_0_50px_-12px_rgba(0,0,0,0.12)] rounded-3xl bg-white dark:bg-slate-900 relative overflow-hidden">
                    <CardContent className="p-4 sm:p-6 pb-0 flex flex-col items-center gap-4 relative z-10">
                        <LiveClockUI />

                        <div className="grid grid-cols-2 gap-4 w-full px-2">
                            {/* Card Masuk */}
                            <div className="bg-green-50/60 dark:bg-green-950/10 rounded-2xl p-3 border border-green-100/50 flex items-center gap-3 relative overflow-hidden shadow-sm" style={{ transform: 'translateZ(0)' }}>
                                <div className="absolute top-1/2 left-2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#2ecc71]/10 blur-xl z-0" />
                                <div className="bg-[#2ecc71] p-2.5 rounded-[1.1rem] text-white shrink-0 shadow-lg shadow-green-500/20 relative z-10">
                                    <LogIn className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col relative z-10">
                                    <p className="text-[10px] font-black text-[#2ecc71] mb-0.5">Masuk</p>
                                    <p className="text-lg font-black tabular-nums text-slate-800 dark:text-white">
                                        {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--')}
                                    </p>
                                </div>
                            </div>

                            {/* Card Pulang */}
                            <div className="bg-blue-50/60 dark:bg-blue-950/10 rounded-2xl p-3 border border-blue-100/50 flex items-center gap-3 relative overflow-hidden shadow-sm" style={{ transform: 'translateZ(0)' }}>
                                <div className="absolute top-1/2 left-2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#3498db]/10 blur-xl z-0" />
                                <div className="bg-[#3498db] p-2.5 rounded-[1.1rem] text-white shrink-0 shadow-lg shadow-blue-500/20 relative z-10">
                                    <LogOut className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col relative z-10">
                                    <p className="text-[10px] font-black text-[#3498db] mb-0.5">Pulang</p>
                                    <p className="text-lg font-black tabular-nums text-slate-800 dark:text-white">
                                        {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="w-full flex flex-col items-center gap-2 px-2">
                            {renderAttendanceButton()}
                        </div>
                    </CardContent>

                    {/* Footer Riwayat dengan Lengkungan Halus */}
                    <div className="relative mt-2 overflow-hidden bg-transparent w-full">
                        <div className="absolute inset-x-0 bottom-0 z-0 h-20 pointer-events-none">
                            <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="w-full h-full">
                                <defs>
                                    <linearGradient id="waveGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                                        <stop offset="0%" stopColor="currentColor" className="text-slate-100 dark:text-slate-800" stopOpacity="1" />
                                        <stop offset="100%" stopColor="currentColor" className="text-slate-100 dark:text-slate-800" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path d="M0 120 V50 C 100 10 300 90 400 30 V120 H0 Z" fill="url(#waveGradient)" />
                            </svg>
                        </div>
                        
                        <Link href="/dashboard/laporan" className="relative z-10 w-full flex items-center justify-center gap-3 py-4 hover:opacity-80 transition-opacity active:scale-[0.98]">
                            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                Lihat riwayat lengkap
                            </span>
                            <ChevronRight className="h-3 w-3 text-blue-400 opacity-50" />
                        </Link>
                    </div>
                </Card>
            </div>
        )}

        {(isAdmin || isKepsek) && (
            <div className="w-full space-y-4 pt-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                    <Card 
                        className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={() => scrollToId('recent-attendance')}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80">Hadir</span>
                            <User className="h-3 w-3 opacity-60" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.hadir}
                        </div>
                    </Card>

                    <Card 
                        className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={() => scrollToId('absent-users')}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80">Izin/Sakit</span>
                            <User className="h-3 w-3 opacity-60" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.izin + stats.sakit}
                        </div>
                    </Card>

                    <Card 
                        className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={navigateToApproval}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80">Menunggu</span>
                            <MailWarning className="h-3 w-3 opacity-60" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.pending}
                        </div>
                    </Card>

                    <Card 
                        className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={() => scrollToId('absent-users')}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-normal opacity-80">Alpa</span>
                            <UserX className="h-3 w-3 opacity-60" />
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
            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-2xl bg-primary/5 mt-2 overflow-hidden">
                <div className="p-6 pb-2">
                    <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                            <h2 className="text-lg font-bold tracking-tight text-foreground">
                                Riwayat Bulan {format(summaryMonth, 'MMMM', { locale: id })}
                            </h2>
                            <p className="text-xs font-bold text-muted-foreground">
                                Persentase: {isPersonalSummaryLoading ? '...' : `${personalSummary.percentage}%`}
                            </p>
                        </div>
                        <div className="flex items-center bg-muted/40 rounded-xl border border-muted-foreground/5 p-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shadow-none" onClick={handlePrevMonth} disabled={isPersonalSummaryLoading || !canGoPrev}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shadow-none" onClick={handleNextMonth} disabled={isPersonalSummaryLoading || !canGoNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
                <CardContent className="p-6 pt-2">
                    <div className="w-full h-48 mt-2">
                        {isPersonalSummaryLoading ? (
                            <Skeleton className="h-full w-full rounded-xl" />
                        ) : isClient && (
                            <ChartContainer config={chartConfig} className="h-full w-full">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.2} />
                                    <XAxis dataKey="name" axisLine={{ stroke: 'currentColor', opacity: 0.2 }} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6, fontStyle: 'normal' }} />
                                    <YAxis axisLine={{ stroke: 'currentColor', opacity: 0.2 }} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6, fontWeight: 'bold' }} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05, radius: 8 }} content={<CustomTooltip />} />
                                    <Bar dataKey="Jumlah" radius={[4, 4, 0, 0]} barSize={35}>
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

