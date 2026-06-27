
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,  UserCheck,  UserX,  BookUser,  Loader2,  School, LogIn, LogOut, TrendingUp, AlertCircle, Info, MailWarning
} from 'lucide-react';
import {
  Card,  CardContent,  CardDescription,  CardHeader,  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection,  query,  where,  Timestamp,  getDocs, getCountFromServer, collectionGroup, orderBy, limit, doc
} from 'firebase/firestore';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, format, isWithinInterval, addDays, subDays, setHours, setMinutes, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';
import { getFromCache, setInCache } from '@/lib/cache';
import { calculateAttendanceStats, getDailyStaffAttendanceStats } from '@/lib/attendance'; 
import { useAttendanceWindow } from '@/hooks/use-attendance-window';

import TodaysActivityTable from '@/components/dashboard/RecentAttendanceTable';
import AbsentUsersTable from '@/components/dashboard/AbsentUsersTable';

const roleDescriptions: { [key: string]: string } = {
  admin: 'Kelola pengguna, konfigurasi, dan pantau aktivitas.',
  kepala_sekolah: 'Pantau aktivitas guru & pegawai, serta proses izin.',
  guru: 'Lakukan absensi dan lihat riwayat kehadiran Anda.',
  pegawai: 'Lakukan absensi dan lihat riwayat kehadiran Anda.',
};

const WelcomeCard = ({ user, isLoading }: { user: any, isLoading: boolean }) => (
    <div className="space-y-1">
        <p className="text-base text-muted-foreground leading-none">Selamat Datang</p>
        {isLoading ? (
            <Skeleton className="h-7 w-48 mt-1" />
        ) : (
            <h1 className="text-xl font-bold">{user?.name || 'Pengguna'}</h1>
        )}
        {isLoading ? (
            <Skeleton className="h-4 w-72 mt-2" />
        ) : (
            <p className="text-sm text-muted-foreground">{roleDescriptions[user?.role || ''] || 'Selamat datang di dasbor Anda.'}</p>
        )}
    </div>
);

const StatCard = ({ title, value, icon: Icon, description, isLoading, className, onClick }: any) => (
    <Card className={`h-full flex flex-col transition-all duration-200 ${className || ''}`} onClick={onClick}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
        <CardContent className="flex-grow">
            {isLoading ? (
                 <Skeleton className="h-8 w-1/2" />
            ) : (
                <>
                    <div className="text-2xl font-bold">{value}</div>
                    {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                </>
            )}
        </CardContent>
    </Card>
);

const PersonalAttendanceCardUI = ({ attendanceData, isLoading }: { attendanceData: any, isLoading: boolean }) => {
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const { status: attendanceWindowStatus } = useAttendanceWindow();

    useEffect(() => { 
        const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timerId); 
    }, []);

    const attendanceRecord = attendanceData?.[0];
    const checkInTime = attendanceRecord?.checkInTime ? format(attendanceRecord.checkInTime.toDate(), 'HH:mm') : '--:--';
    const checkOutTime = attendanceRecord?.checkOutTime ? format(attendanceRecord.checkOutTime.toDate(), 'HH:mm') : '--:--';

    return (
        <Card className="h-full flex flex-col">
            <CardHeader><CardTitle>Kehadiran Anda Hari Ini</CardTitle><CardDescription>Status kehadiran dan jam absensi Anda.</CardDescription></CardHeader>
            <CardContent className="flex flex-col flex-grow items-center justify-center space-y-6 pb-8">
                {isLoading ? (
                    <div className="w-full space-y-6">
                        <div className="flex flex-col items-center gap-2">
                            <Skeleton className="h-12 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : (
                    <>
                        <div className="text-center">
                            <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight tabular-nums">{format(currentTime, 'HH:mm:ss')}</p>
                            <p className="text-lg text-muted-foreground">{format(currentTime, 'eeee, d MMMM yyyy', { locale: id })}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="text-center bg-muted p-3 rounded-lg"><h3 className="font-semibold text-sm flex items-center justify-center gap-2"><LogIn size={14}/> Absen Masuk</h3><p className="text-3xl font-bold">{checkInTime}</p></div>
                            <div className="text-center bg-muted p-3 rounded-lg"><h3 className="font-semibold text-sm flex items-center justify-center gap-2"><LogOut size={14}/> Absen Pulang</h3><p className="text-3xl font-bold">{checkOutTime}</p></div>
                        </div>
                        <div className="w-full flex flex-col items-center space-y-2 pt-4">
                            <Button size="lg" className="w-full h-12 text-lg font-bold" onClick={() => router.push('/dashboard/absen')}>Absen Sekarang</Button>
                            <Button variant="link" asChild><Link href="/dashboard/laporan">Lihat Riwayat Lengkap</Link></Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

const MonthlyAttendanceChartUI = ({ summaryData, isLoading }: { summaryData: any, isLoading: boolean }) => {
    const now = new Date();
    return (
        <Card className="h-full flex flex-col">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp size={20} /> Riwayat Bulan {format(now, 'MMMM', { locale: id })}</CardTitle><CardDescription>Persentase kehadiran: {isLoading ? '...' : `${summaryData.percentage}%`}</CardDescription></CardHeader>
            <CardContent className="flex-grow min-h-[250px]">
                {isLoading ? 
                    <div className="flex flex-col gap-4 h-full">
                        <Skeleton className="h-full w-full" />
                    </div> : 
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                            { name: 'Hadir', jumlah: summaryData.attendanceCount, fill: '#14b8a6' },
                            { name: 'Sakit', jumlah: summaryData.sakitCount, fill: '#f97316' },
                            { name: 'Izin', jumlah: summaryData.izinCount, fill: '#facc15' },
                            { name: 'Alpa', jumlah: summaryData.alpaCount, fill: '#334155' },
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} />
                            <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={30} />
                            <Tooltip />
                            <Bar dataKey="jumlah" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                }
            </CardContent>
        </Card>
    );
};

function useMonthlyAttendanceSummary(user: any) {
    const firestore = useFirestore();
    const cacheKey = useMemo(() => user ? `monthlySummary_v3_${user.uid}` : null, [user]);
    const [summary, setSummary] = useState<any>(() => cacheKey ? getFromCache(cacheKey) || null : null);
    const [isLoading, setIsLoading] = useState(summary === null);

    useEffect(() => {
        if (!user || !firestore || !cacheKey || summary !== null) return;
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                const stats = await calculateAttendanceStats(firestore, user.uid, { start: startOfMonth(now), end: endOfMonth(now) });
                const newSummary = { attendanceCount: stats.totalHadir, izinCount: stats.totalIzin, sakitCount: stats.totalSakit, alpaCount: stats.totalAlpa, percentage: stats.persentase.replace('%', '') };
                setSummary(newSummary);
                setInCache(cacheKey, newSummary, 900);
            } catch (error) { setSummary({}); } finally { setIsLoading(false); }
        };
        fetchStats();
    }, [user, firestore, cacheKey, summary]);

    return { summary: summary || {}, isLoading };
}

function useStaffDashboardStats(firestore: any, user: any) {
  const cacheKey = 'staffDashboardStats_v2';
  const [stats, setStats] = useState<any>(() => getFromCache(cacheKey) || null);
  const [isLoading, setIsLoading] = useState(stats === null);

  useEffect(() => {
    if (!firestore || !user || stats !== null) return;
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const dailyStats = await getDailyStaffAttendanceStats(firestore);
        setStats(dailyStats);
        setInCache(cacheKey, dailyStats, 300);
      } catch (error) { setStats({ totalStaff: 0, hadir: 0, izin: 0, sakit: 0, alpa: 0, pending: 0 }); } finally { setIsLoading(false); }
    };
    fetchStats();
  }, [firestore, user, stats]);

  return { stats: stats || { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, alpa: 0, pending: 0 }, isLoading };
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const { stats, isLoading: isStatsLoading } = useStaffDashboardStats(firestore, user);
  const { summary: personalSummary, isLoading: isPersonalSummaryLoading } = useMonthlyAttendanceSummary(user);

  const todaysAttendanceQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('checkInTime', '>=', startOfDay(new Date())), limit(1)) : null, [firestore, user]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysAttendanceQuery);

  const role = user?.role;
  const showMonitoring = role === 'admin' || role === 'kepala_sekolah';
  const showPersonal = role !== 'admin';

  return (
    <div className="flex-1 pt-4 pb-24 md:p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:col-span-4 md:gap-6">
            <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4">
                <WelcomeCard user={user} isLoading={isUserLoading} />
            </div>

            {showPersonal && (
                <>
                    <div className="md:col-span-2 lg:col-span-2 xl:col-span-2">
                        <PersonalAttendanceCardUI attendanceData={todaysAttendance} isLoading={isAttendanceLoading || isUserLoading} />
                    </div>
                    <div className="md:col-span-2 lg:col-span-1 xl:col-span-2">
                        <MonthlyAttendanceChartUI summaryData={personalSummary} isLoading={isPersonalSummaryLoading || isUserLoading} />
                    </div>
                </>
            )}

            {showMonitoring && (
                <>
                    <StatCard title="Hadir Hari Ini" value={stats.hadir} icon={UserCheck} isLoading={isStatsLoading || isUserLoading} />
                    <StatCard title="Izin/Sakit" value={stats.izin + stats.sakit} icon={BookUser} description={`${stats.izin} Izin, ${stats.sakit} Sakit`} isLoading={isStatsLoading || isUserLoading} />
                    <StatCard title="Menunggu" value={stats.pending} icon={MailWarning} description="Pengajuan tertunda" isLoading={isStatsLoading || isUserLoading} className="cursor-pointer hover:bg-muted" onClick={() => router.push('/dashboard/izin-kepala-sekolah')} />
                    <StatCard title="Alpa" value={stats.alpa} icon={UserX} isLoading={isStatsLoading || isUserLoading} />
                </>
            )}

            {showMonitoring && (
                <>
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4"><TodaysActivityTable /></div>
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4"><AbsentUsersTable /></div>
                </>
            )}
        </div>
    </div>
  );
}
