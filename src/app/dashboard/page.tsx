'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { TrendingUp, UserCheck, BookUser, MailWarning, Clock, LogIn, LogOut, Sparkles } from 'lucide-react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Data Libs
import { calculateAttendanceStats, getDailyStaffAttendanceStats } from '@/lib/attendance';

// Components
import AbsentUsersTable from '@/components/dashboard/AbsentUsersTable';
import RecentAttendanceTable from '@/components/dashboard/RecentAttendanceTable';

// --- Custom Hooks ---

function useStaffDashboardStats(firestore: any, user: any) {
    const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, pending: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) return;
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const data = await getDailyStaffAttendanceStats(firestore);
                setStats(data);
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [firestore, user]);

    return { stats, isLoading };
}

function useMonthlyAttendanceSummary(user: any) {
    const firestore = useFirestore();
    const [summary, setSummary] = useState({ percentage: '0', hadir: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) return;
        const fetchSummary = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                const stats = await calculateAttendanceStats(firestore, user.uid, { 
                    start: startOfMonth(now), 
                    end: endOfMonth(now) 
                });
                setSummary({
                    percentage: stats.persentase.replace('%', ''),
                    hadir: Math.ceil(stats.totalHadir)
                });
            } catch (error) {
                console.error("Error fetching summary:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSummary();
    }, [firestore, user]);

    return { summary, isLoading };
}

// --- Sub Components ---

const WelcomeCard = ({ user, isLoading }: { user: any, isLoading: boolean }) => {
    if (isLoading) return <Skeleton className="h-8 w-48 mb-4" />;
    return (
        <div className="mb-4 space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight">Selamat Datang,</h1>
            <p className="text-sm text-muted-foreground">{user?.name || 'Pengguna'}</p>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, description, isLoading, className, onClick }: any) => (
    <Card className={cn("transition-all shadow-sm w-full", className)} onClick={onClick}>
        <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
            <Icon className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Skeleton className="h-7 w-12" />
            ) : (
                <div className="text-xl font-black">{value}</div>
            )}
            {description && <p className="text-[9px] text-muted-foreground mt-0.5">{description}</p>}
        </CardContent>
    </Card>
);

const LiveClock = () => {
    const [time, setTime] = useState<Date | null>(null);
    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!time) return <div className="h-16" />;

    return (
        <div className="flex flex-col items-center justify-center py-2 mb-4">
            <h2 className="text-5xl font-black tracking-tighter tabular-nums text-foreground leading-none">
                {format(time, 'HH:mm:ss')}
            </h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-2">
                {format(time, 'EEEE, d MMMM yyyy', { locale: id })}
            </p>
        </div>
    );
};

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const { stats, isLoading: isStatsLoading } = useStaffDashboardStats(firestore, user);
  const { summary: personalSummary, isLoading: isPersonalSummaryLoading } = useMonthlyAttendanceSummary(user);

  const todaysAttendanceQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr), limit(1));
  }, [firestore, user]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysAttendanceQuery);

  const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
  const { data: schoolConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const role = user?.role;
  const isAdminOrKepsek = role === 'admin' || role === 'kepala_sekolah';
  const isGuruOrPegawai = role === 'guru' || role === 'pegawai';

  return (
    <PageWrapper>
        <div className="w-full space-y-2">
            <WelcomeCard user={user} isLoading={isUserLoading} />

            <LiveClock />

            {isGuruOrPegawai && (
                <div className="w-full space-y-6">
                    <Card className="w-full overflow-hidden shadow-sm border-muted/50">
                        <CardHeader className="pb-3 space-y-1">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <div className="p-1.5 rounded-full bg-primary/10">
                                    <Clock className="w-4 h-4 text-primary" />
                                </div>
                                Kehadiran Anda Hari Ini
                            </CardTitle>
                            <CardDescription className="text-xs">Status kehadiran dan jam absensi harian Anda.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/30 rounded-xl p-4 text-center border border-border/40">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Masuk</p>
                                    <p className="text-2xl font-black tabular-nums">
                                        {todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--'}
                                    </p>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-4 text-center border border-border/40">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Pulang</p>
                                    <p className="text-2xl font-black tabular-nums">
                                        {todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/5 border-t py-4">
                            {todaysAttendance?.[0]?.checkInTime && !todaysAttendance?.[0]?.checkOutTime ? (
                                <Button asChild size="lg" className="w-full font-bold shadow-sm">
                                    <Link href="/dashboard/absen"><LogOut className="mr-2 w-4 h-4" /> Absen Pulang</Link>
                                </Button>
                            ) : !todaysAttendance?.[0]?.checkInTime ? (
                                <Button asChild size="lg" className="w-full font-bold shadow-sm">
                                    <Link href="/dashboard/absen"><LogIn className="mr-2 w-4 h-4" /> Absen Masuk</Link>
                                </Button>
                            ) : (
                                <Button disabled size="lg" className="w-full bg-green-500/10 text-green-600 border-green-500/20 font-bold">
                                    <Sparkles className="mr-2 w-4 h-4" /> Absensi Selesai
                                </Button>
                            )}
                        </CardFooter>
                    </Card>

                    <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                            <h2 className="flex items-center gap-2 text-xs font-black text-foreground uppercase tracking-tight">
                                <TrendingUp size={14} className="text-primary" /> RIWAYAT {format(new Date(), 'MMMM', { locale: id }).toUpperCase()}
                            </h2>
                            <div className="text-right">
                                <span className="text-xl font-black text-primary leading-none">
                                    {isPersonalSummaryLoading ? '...' : `${personalSummary.percentage}%`}
                                </span>
                                <p className="text-[7px] font-bold text-muted-foreground uppercase">Hadir</p>
                            </div>
                        </div>
                        
                        <Card className="w-full shadow-sm">
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Hadir: {personalSummary.hadir} Hari</p>
                                    <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-primary h-full transition-all duration-1000 ease-in-out" 
                                            style={{ width: `${personalSummary.percentage}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs font-bold text-primary">
                                            <Link href="/dashboard/laporan">Lihat Detail Laporan</Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {isAdminOrKepsek && (
                <div className="w-full space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        <StatCard 
                            title="Hadir Hari Ini" 
                            value={stats.hadir} 
                            icon={UserCheck} 
                            isLoading={isStatsLoading || isUserLoading} 
                        />
                        <StatCard 
                            title="Izin/Sakit" 
                            value={stats.izin + stats.sakit} 
                            icon={BookUser} 
                            description={`${stats.izin} Izin, ${stats.sakit} Sakit`} 
                            isLoading={isStatsLoading || isUserLoading} 
                        />
                        <StatCard 
                            title="Menunggu" 
                            value={stats.pending} 
                            icon={MailWarning} 
                            description="Pengajuan tertunda" 
                            isLoading={isStatsLoading || isUserLoading} 
                            className="cursor-pointer hover:bg-accent/5 border-primary/10" 
                            onClick={() => router.push('/dashboard/izin-kepala-sekolah')} 
                        />
                    </div>
                    <div className="w-full"><RecentAttendanceTable /></div>
                    <div className="w-full"><AbsentUsersTable /></div>
                </div>
            )}
        </div>
    </PageWrapper>
  );
}
