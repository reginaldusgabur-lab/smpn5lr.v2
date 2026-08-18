
'use client';

import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, addMonths, subMonths, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { LogIn, LogOut, Sparkles, User, CalendarCheck, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

    if (!time) return <div className="h-20 w-full flex items-center justify-center"><Skeleton className="h-12 w-48" /></div>;

    return (
        <div className="flex flex-col items-center justify-center py-4 w-full" style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-full mb-4">
                <Clock className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-6xl font-bold tracking-tight tabular-nums text-foreground leading-none">
                {format(time, 'HH:mm:ss')}
            </h2>
            <p className="text-xs font-bold text-muted-foreground mt-4 uppercase tracking-[0.2em]">
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

  const renderStatusAlert = () => {
    const record = todaysAttendance?.[0];
    const isCheckedIn = !!record?.checkInTime;
    const isCheckedOut = !!record?.checkOutTime;

    if (currentActiveLeave) {
        return (
            <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-bold text-blue-600 uppercase tracking-tight">{currentActiveLeave.type} Disetujui</span>
            </div>
        );
    }

    if (isCheckedOut) {
        return (
            <div className="w-full bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-center gap-3">
                <Sparkles className="h-5 w-5 text-green-500" />
                <span className="text-sm font-bold text-green-600 uppercase tracking-tight">Absensi hari ini selesai</span>
            </div>
        );
    }

    if (windowStatus === 'AFTER_IN' && !isCheckedIn) {
        return (
            <div className="w-full bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="bg-white rounded-full p-1 border border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
                <span className="text-sm font-bold text-red-500">Batas jam masuk berakhir</span>
            </div>
        );
    }

    if (windowStatus === 'CHECK_IN_OPEN' && !isCheckedIn) {
        return (
            <Button asChild className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all">
                <Link href="/dashboard/absen">Absen Masuk Sekarang</Link>
            </Button>
        );
    }

    if (windowStatus === 'CHECK_OUT_OPEN' && isCheckedIn && !isCheckedOut) {
        return (
            <Button asChild className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                <Link href="/dashboard/absen">Absen Pulang Sekarang</Link>
            </Button>
        );
    }

    if (windowStatus === 'BEFORE_IN') {
        return (
            <div className="w-full bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-center justify-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-bold text-muted-foreground">Belum waktu jam masuk</span>
            </div>
        );
    }

    return null;
  };

  if (isUserLoading || !isClient) return <div className="w-full space-y-6 animate-pulse p-4"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-48" /></div><div className="pt-10 space-y-4"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-40 w-full rounded-xl" /></div></div>;

  const isAdmin = user?.role === 'admin';
  const isKepsek = user?.role === 'kepala_sekolah';
  const isStaffOnly = ['guru', 'pegawai', 'siswa'].includes(user?.role || '');

  return (
    <div className="w-full space-y-6 pb-20 flex flex-col items-stretch max-w-2xl mx-auto">
        <div className="w-full px-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Selamat datang</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground leading-tight">{user?.name || 'Pengguna'}</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">
                Lakukan absensi dan lihat riwayat kehadiran Anda.
            </p>
        </div>

        {!isAdmin && (
            <div className="w-full space-y-6">
                {/* BLUE HEADER CARD */}
                <Card className="w-full border-none shadow-none rounded-[2rem] bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 overflow-hidden relative">
                    <CardContent className="p-8 flex items-center gap-6 text-white">
                        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
                            <CalendarCheck className="h-10 w-10 text-white" />
                        </div>
                        <div className="flex flex-col gap-1 relative z-10">
                            <h2 className="text-2xl font-bold tracking-tight">Kehadiran hari ini</h2>
                            <p className="text-sm font-medium text-white/80">Kelola absensi dan pantau kehadiran Anda dengan mudah.</p>
                        </div>
                        {/* DECORATIVE ICON */}
                        <div className="absolute top-1/2 -right-6 -translate-y-1/2 opacity-10">
                            <User className="h-32 w-32" />
                        </div>
                    </CardContent>
                </Card>

                {/* MAIN WHITE CARD */}
                <Card className="w-full border-none shadow-xl shadow-blue-600/5 rounded-[2rem] bg-card overflow-hidden">
                    <CardContent className="p-10 flex flex-col items-center gap-10">
                        {/* CLOCK SECTION */}
                        <LiveClockUI />

                        {/* STATUS GRID */}
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="bg-[#f2faf5] dark:bg-green-950/20 rounded-2xl p-5 border border-green-100/50 flex items-center gap-4 relative overflow-hidden">
                                <div className="bg-[#2ecc71] p-3 rounded-2xl text-white shrink-0">
                                    <LogIn className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">MASUK</p>
                                    <p className="text-2xl font-bold tabular-nums text-foreground">
                                        {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--')}
                                    </p>
                                </div>
                                {/* SUBTLE WAVE PATTERN PLACEHOLDER */}
                                <div className="absolute -bottom-2 -right-2 opacity-5 scale-150 rotate-12">
                                    <LogIn className="h-16 w-16" />
                                </div>
                            </div>

                            <div className="bg-[#f2f7ff] dark:bg-blue-950/20 rounded-2xl p-5 border border-blue-100/50 flex items-center gap-4 relative overflow-hidden">
                                <div className="bg-[#3498db] p-3 rounded-2xl text-white shrink-0">
                                    <LogOut className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">PULANG</p>
                                    <p className="text-2xl font-bold tabular-nums text-foreground">
                                        {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--')}
                                    </p>
                                </div>
                                <div className="absolute -bottom-2 -right-2 opacity-5 scale-150 rotate-12">
                                    <LogOut className="h-16 w-16" />
                                </div>
                            </div>
                        </div>

                        {/* ALERT / BUTTON SECTION */}
                        <div className="w-full">
                            {renderStatusAlert()}
                        </div>

                        {/* FOOTER LINK */}
                        <Link href="/dashboard/laporan" className="flex items-center gap-2 text-sm font-bold text-primary hover:opacity-70 transition-all uppercase tracking-tight">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <CalendarCheck className="h-4 w-4" />
                            </div>
                            Lihat riwayat lengkap
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )}

        {(isAdmin || isKepsek) && (
            <div className="w-full space-y-4 pt-2">
                {/* STATS SUMMARY SECTION */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                    <Card 
                        className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-2xl overflow-hidden p-4 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={() => scrollToId('recent-attendance')}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Hadir</span>
                            <User className="h-4 w-4 opacity-60" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.hadir}
                        </div>
                    </Card>

                    <Card 
                        className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-2xl overflow-hidden p-4 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={() => scrollToId('absent-users')}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Izin/Sakit</span>
                            <User className="h-4 w-4 opacity-60" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.izin + stats.sakit}
                        </div>
                    </Card>

                    <Card 
                        className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-2xl overflow-hidden p-4 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={navigateToApproval}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Menunggu</span>
                            <Clock className="h-4 w-4 opacity-60" />
                        </div>
                        <div className="text-3xl font-normal tracking-tight">
                            {isStatsLoading ? '...' : stats.pending}
                        </div>
                    </Card>

                    <Card 
                        className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-2xl overflow-hidden p-4 cursor-pointer hover:opacity-90 transition-all group text-white"
                        onClick={() => scrollToId('absent-users')}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Alpa</span>
                            <User className="h-4 w-4 opacity-60" />
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
            <Card className="w-full border border-muted-foreground/10 shadow-none rounded-[2rem] bg-primary/5 mt-4 overflow-hidden">
                <div className="p-8 pb-2">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold tracking-tight text-foreground">
                                Riwayat Bulan {format(summaryMonth, 'MMMM', { locale: id })}
                            </h2>
                            <p className="text-sm font-medium text-muted-foreground">
                                Persentase: {isPersonalSummaryLoading ? '...' : `${personalSummary.percentage}%`}
                            </p>
                        </div>
                        <div className="flex items-center bg-muted/40 rounded-xl border border-muted-foreground/5 p-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shadow-none" onClick={handlePrevMonth} disabled={isPersonalSummaryLoading || !canGoPrev}>
                                <LogIn className="h-4 w-4 rotate-180" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shadow-none" onClick={handleNextMonth} disabled={isPersonalSummaryLoading || !canGoNext}>
                                <LogIn className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
                <CardContent className="p-8 pt-4">
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

