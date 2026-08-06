'use client';

import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, addMonths, subMonths, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { TrendingUp, LogIn, LogOut, Sparkles, UserCheck, BookUser, MailWarning, Clock, Lock, AlertCircle, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
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
        <p className="font-semibold text-foreground text-base tracking-tight leading-none mb-1.5">{data.name}</p>
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
            <h2 className="text-4xl font-bold tracking-tight tabular-nums text-foreground leading-none">
                {format(time, 'HH:mm:ss')}
            </h2>
            <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider opacity-60">
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
    { name: 'Hadir', Jumlah: personalSummary.hadir, color: 'hsl(var(--primary))' },
    { name: 'Sakit', Jumlah: personalSummary.sakit, color: '#f97316' },
    { name: 'Izin', Jumlah: personalSummary.izin, color: '#3b82f6' },
    { name: 'Alpa', Jumlah: personalSummary.alpa, color: '#dc2626' },
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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    }
  };

  const navigateToApproval = () => {
    if (user?.role === 'admin') {
        router.push('/dashboard/admin/izin');
    } else if (user?.role === 'kepala_sekolah') {
        router.push('/dashboard/izin-kepala-sekolah');
    }
  };

  const renderAttendanceButton = () => {
    const record = todaysAttendance?.[0];
    const isCheckedIn = !!record?.checkInTime;
    const isCheckedOut = !!record?.checkOutTime;
    const isManualFinished = record?.manualEntry && (record?.reasonForUpdate === 'Pulang cepat' || record?.reasonForUpdate === 'Dinas siang');

    const disabledStyle = "w-full bg-primary/5 text-primary/40 border border-primary/10 font-semibold rounded-xl h-12 flex items-center justify-center text-sm transition-all cursor-default select-none shadow-md";

    if (windowStatus === 'LOADING' || isAttendanceLoading || isLeaveLoading) {
        return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4 animate-spin" /> Memuat data...</div>;
    }

    if (currentActiveLeave) {
        return (
            <div className="w-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-md">
                <Sparkles className="mr-2 w-4 h-4" /> 
                {currentActiveLeave.type} Disetujui
            </div>
        );
    }

    if (isCheckedOut || isManualFinished) {
        return <div className="w-full bg-green-500/5 text-green-600 border border-green-500/20 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-md"><Sparkles className="mr-2 w-4 h-4" /> Absensi selesai</div>;
    }

    if (windowStatus === 'DISABLED' || stats.isManualDisabled) {
        return <div className="w-full bg-muted text-muted-foreground border border-border font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-md"><Lock className="mr-2 h-4 w-4" /> Sistem sedang dinonaktifkan</div>;
    }

    if (!isCheckedIn && (windowStatus === 'SESSION_INACTIVE' || stats.isHoliday)) {
        const label = stats.isCalendarHoliday ? 'Hari libur (Kalender)' : 'Hari libur rutin';
        return (
            <div className="w-full bg-muted text-muted-foreground border border-border font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-md">
                <Lock className="mr-2 h-4 w-4" /> {label}
            </div>
        );
    }

    if (windowStatus === 'CHECK_OUT_OPEN') {
        return (
            <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 shadow-md active:scale-95 transition-all bg-blue-600 hover:bg-blue-700 text-white">
                <Link href="/dashboard/absen">Absen pulang sekarang</Link>
            </Button>
        );
    }

    if (!isCheckedIn) {
        if (windowStatus === 'BEFORE_IN') return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4" /> Belum waktu jam masuk</div>;
        if (windowStatus === 'CHECK_IN_OPEN') return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 shadow-md active:scale-95 transition-all"><Link href="/dashboard/absen">Absen masuk sekarang</Link></Button>;
        if (windowStatus === 'AFTER_IN') return <div className="w-full bg-destructive/5 text-destructive/60 border border-destructive/10 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-md"><AlertCircle className="mr-2 h-4 w-4" /> Batas jam masuk berakhir</div>;
    }

    if (isCheckedIn && !isCheckedOut) {
        if (windowStatus === 'AFTER_IN') return <div className={disabledStyle}><Clock className="mr-2 h-4 w-4" /> Belum waktu jam pulang</div>;
    }

    if (windowStatus === 'CLOSED') {
        return (
            <div className="w-full bg-destructive/5 text-destructive/60 border border-destructive/10 font-semibold rounded-xl h-12 flex items-center justify-center text-sm shadow-md">
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
    <div className="w-full space-y-6 pb-10 flex flex-col items-stretch">
        <div className="w-full px-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Selamat datang</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground mt-0.5 leading-tight">{user?.name || 'Pengguna'}</h1>
            <p className="text-sm font-normal text-muted-foreground mt-1">
                {isAdmin ? 'Pantau aktivitas kehadiran hari ini.' : 'Lakukan absensi dan lihat riwayat kehadiran Anda.'}
            </p>
        </div>

        {!isAdmin && (
            <div className="w-full space-y-1.5">
                <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-card overflow-hidden">
                    <CardContent className="p-4 text-center">
                        <CardTitle className="text-xl font-bold tracking-tight text-primary drop-shadow-sm">Kehadiran hari ini</CardTitle>
                    </CardContent>
                </Card>

                <Card className="w-full border border-muted-foreground/10 shadow-md rounded-xl bg-card isolate overflow-hidden" style={{ transform: 'translateZ(0)' }}>
                    <CardContent className="p-6 space-y-4 pt-6 text-center">
                        <LiveClockUI />
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/40 flex flex-col items-center justify-center" style={{ transform: 'translateZ(0)' }}>
                                <div className="flex items-center justify-center gap-2 mb-1.5">
                                    <LogIn className="w-3.5 h-3.5 text-primary" />
                                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Masuk</p>
                                </div>
                                <p className="text-xl font-bold tabular-nums text-foreground">
                                    {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--')}
                                </p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/40 flex flex-col items-center justify-center" style={{ transform: 'translateZ(0)' }}>
                                <div className="flex items-center justify-center gap-2 mb-1.5">
                                    <LogOut className="w-3.5 h-3.5 text-primary" />
                                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Pulang</p>
                                </div>
                                <p className="text-xl font-bold tabular-nums text-foreground">
                                    {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--')}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-stretch gap-3">
                            {renderAttendanceButton()}
                            <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"><Link href="/dashboard/laporan">Lihat riwayat lengkap</Link></Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {(isAdmin || isKepsek) && (
            <div className="w-full space-y-4 pt-2 flex flex-col items-stretch">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                    <Card 
                        className="bg-card border border-muted-foreground/10 shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:bg-green-500/5 transition-colors group"
                        onClick={() => scrollToSection('recent-attendance')}
                    >
                        <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-green-600 drop-shadow-sm">Hadir</CardTitle>
                            <UserCheck className="h-3 w-3 text-green-600 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <div className="text-2xl font-black text-green-600 tracking-tighter">
                            {isStatsLoading ? '...' : stats.hadir}
                        </div>
                    </Card>
                    <Card 
                        className="bg-card border border-muted-foreground/10 shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:bg-blue-500/5 transition-colors group"
                        onClick={() => scrollToSection('absent-users')}
                    >
                        <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-blue-600 drop-shadow-sm">Izin/Sakit</CardTitle>
                            <BookUser className="h-3 w-3 text-blue-600 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <div className="text-2xl font-black text-blue-600 tracking-tighter">
                            {isStatsLoading ? '...' : stats.izin + stats.sakit}
                        </div>
                    </Card>
                    <Card 
                        className="bg-card border border-muted-foreground/10 shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:bg-amber-500/5 transition-colors group"
                        onClick={navigateToApproval}
                    >
                        <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-amber-600 drop-shadow-sm">Menunggu</CardTitle>
                            <MailWarning className="h-3 w-3 text-amber-600 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <div className="text-2xl font-black text-amber-600 tracking-tighter">
                            {isStatsLoading ? '...' : stats.pending}
                        </div>
                    </Card>
                    <Card 
                        className="bg-card border border-muted-foreground/10 shadow-md rounded-xl overflow-hidden p-3 cursor-pointer hover:bg-red-500/5 transition-colors group"
                        onClick={() => scrollToSection('absent-users')}
                    >
                        <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-red-600 drop-shadow-sm">Alpa</CardTitle>
                            <UserX className="h-3 w-3 text-red-600 group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <div className="text-2xl font-black text-red-600 tracking-tighter">
                            {isStatsLoading ? '...' : stats.alpa}
                        </div>
                    </Card>
                </div>
                
                <div id="recent-attendance">
                    <RecentAttendanceTable />
                </div>
                
                <div id="absent-users">
                    <AbsentUsersTable />
                </div>
            </div>
        )}

        {isStaffOnly && !isAdmin && (
            <Card className="w-full border border-muted-foreground/10 shadow-md rounded-xl overflow-hidden bg-card mt-2">
                <CardHeader className="p-6 pb-2 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)] relative z-10 bg-card">
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
