'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { TrendingUp, LogIn, LogOut, Sparkles, UserCheck, BookUser, MailWarning, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Data Libs
import { calculateAttendanceStats, getDailyStaffAttendanceStats } from '@/lib/attendance';

// Components
import AbsentUsersTable from '@/components/dashboard/AbsentUsersTable';
import RecentAttendanceTable from '@/components/dashboard/RecentAttendanceTable';

// --- Sub Components ---

const LiveClockUI = () => {
    const [time, setTime] = useState<Date | null>(null);
    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!time) return <div className="h-24 w-full" />;

    return (
        <div className="flex flex-col items-center justify-center py-6 w-full">
            <h2 className="text-6xl sm:text-7xl font-black tracking-tighter tabular-nums text-primary leading-none">
                {format(time, 'HH:mm:ss')}
            </h2>
            <p className="text-sm font-bold text-muted-foreground mt-4 capitalize">
                {format(time, 'EEEE, d MMMM yyyy', { locale: id })}
            </p>
        </div>
    );
};

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, pending: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [personalSummary, setPersonalSummary] = useState({ percentage: '0', hadir: 0, izin: 0, sakit: 0, alpa: 0 });
  const [isPersonalSummaryLoading, setIsPersonalSummaryLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user) return;
    const loadDashboardData = async () => {
        setIsStatsLoading(true);
        setIsPersonalSummaryLoading(true);
        try {
            const now = new Date();
            const [dailyStats, personalStats] = await Promise.all([
                getDailyStaffAttendanceStats(firestore),
                calculateAttendanceStats(firestore, user.uid, { start: startOfMonth(now), end: endOfMonth(now) })
            ]);
            setStats(dailyStats);
            setPersonalSummary({
                percentage: personalStats.persentase.replace('%', ''),
                hadir: Math.ceil(personalStats.totalHadir),
                izin: personalStats.totalIzin,
                sakit: personalStats.totalSakit,
                alpa: personalStats.totalAlpa
            });
        } catch (error) {
            console.error("Dashboard error:", error);
        } finally {
            setIsStatsLoading(false);
            setIsPersonalSummaryLoading(false);
        }
    };
    loadDashboardData();
  }, [firestore, user]);

  const todaysAttendanceQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr), limit(1));
  }, [firestore, user]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysAttendanceQuery);

  if (isUserLoading) {
    return (
        <div className="w-full space-y-6 animate-pulse">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-48" />
            </div>
            <div className="pt-10 space-y-4">
                <Skeleton className="h-40 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
        </div>
    );
  }

  const role = user?.role;
  const isAdminOrKepsek = role === 'admin' || role === 'kepala_sekolah';
  const isGuruOrPegawai = role === 'guru' || role === 'pegawai' || role === 'siswa' || role === 'kepala_sekolah';

  const chartData = [
    { name: 'Hadir', value: personalSummary.hadir, color: 'hsl(var(--primary))' },
    { name: 'Izin', value: personalSummary.izin, color: '#3b82f6' },
    { name: 'Sakit', value: personalSummary.sakit, color: '#f59e0b' },
    { name: 'Alpa', value: personalSummary.alpa, color: '#ef4444' },
  ];

  return (
    <div className="w-full space-y-12 pb-10">
        {/* WELCOME SECTION (FLAT) */}
        <div className="w-full px-0">
            <p className="text-sm text-muted-foreground font-medium">Selamat Datang</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground mt-1">{user?.name || 'Pengguna'}</h1>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">Lakukan absensi dan lihat riwayat kehadiran Anda.</p>
        </div>

        {isGuruOrPegawai && (
            <div className="w-full space-y-12">
                {/* ATTENDANCE SECTION */}
                <div className="w-full space-y-4">
                    <div className="flex items-center gap-2 px-0 mb-2">
                        <Clock className="w-5 h-5 text-primary" />
                        <h2 className="text-base font-black uppercase tracking-tighter">Kehadiran Hari Ini</h2>
                    </div>
                    
                    <div className="w-full py-8">
                        <LiveClockUI />
                        
                        <div className="grid grid-cols-2 gap-4 mt-8 w-full">
                            <div className="bg-muted/30 rounded-2xl p-4 text-center border border-border/40 flex flex-col items-center justify-center">
                                <div className="flex items-center justify-center gap-1.5 mb-1 opacity-60">
                                    <LogIn className="w-3.5 h-3.5" />
                                    <p className="text-[9px] uppercase font-black tracking-widest">Masuk</p>
                                </div>
                                <p className="text-2xl font-black tabular-nums">
                                    {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--')}
                                </p>
                            </div>
                            <div className="bg-muted/30 rounded-2xl p-4 text-center border border-border/40 flex flex-col items-center justify-center">
                                <div className="flex items-center justify-center gap-1.5 mb-1 opacity-60">
                                    <LogOut className="w-3.5 h-3.5" />
                                    <p className="text-[9px] uppercase font-black tracking-widest">Pulang</p>
                                </div>
                                <p className="text-2xl font-black tabular-nums">
                                    {isAttendanceLoading ? '...' : (todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4 mt-10">
                            {todaysAttendance?.[0]?.checkInTime && !todaysAttendance?.[0]?.checkOutTime ? (
                                <Button asChild size="lg" className="w-full font-black rounded-2xl h-14 text-base uppercase tracking-wider">
                                    <Link href="/dashboard/absen">Absen Pulang Sekarang</Link>
                                </Button>
                            ) : !todaysAttendance?.[0]?.checkInTime ? (
                                <Button asChild size="lg" className="w-full font-black rounded-2xl h-14 text-base uppercase tracking-wider">
                                    <Link href="/dashboard/absen">Absen Masuk Sekarang</Link>
                                </Button>
                            ) : (
                                <div className="w-full bg-green-500/10 text-green-600 border border-green-500/20 font-black rounded-2xl h-14 flex items-center justify-center text-base uppercase tracking-widest">
                                    <Sparkles className="mr-2 w-5 h-5" /> Absensi Selesai
                                </div>
                            )}

                            <Button variant="link" size="sm" asChild className="h-auto p-0 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">
                                <Link href="/dashboard/laporan">Lihat Riwayat Lengkap</Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* GRAPH SECTION */}
                <div className="space-y-6 w-full pt-6 border-t border-dashed">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-tight">
                            <TrendingUp size={16} className="text-primary" /> Ringkasan Bulanan
                        </h2>
                        <p className="text-[11px] text-muted-foreground font-black uppercase tracking-wider">
                            Skor: <span className="text-primary">{isPersonalSummaryLoading ? '...' : `${personalSummary.percentage}%`}</span>
                        </p>
                    </div>
                    <div className="w-full h-56">
                        {isPersonalSummaryLoading ? (
                            <Skeleton className="h-full w-full rounded-2xl" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(0,0,0,0.03)' }} 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={45}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        )}

        {isAdminOrKepsek && (
            <div className="w-full space-y-10 pt-6 border-t border-dashed">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hadir</p>
                            <UserCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-3xl font-black">{isStatsLoading ? '...' : stats.hadir}</div>
                    </div>
                    
                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Izin/Sakit</p>
                            <BookUser className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-3xl font-black">{isStatsLoading ? '...' : stats.izin + stats.sakit}</div>
                    </div>

                    <Link href="/dashboard/izin-kepala-sekolah" className="block">
                        <div className="bg-muted/30 border border-border/50 rounded-2xl p-6 hover:bg-accent/10 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Menunggu</p>
                                <MailWarning className="h-4 w-4 text-primary" />
                            </div>
                            <div className="text-3xl font-black">{isStatsLoading ? '...' : stats.pending}</div>
                        </div>
                    </Link>
                </div>
                
                <div className="w-full space-y-12">
                    <RecentAttendanceTable />
                    <AbsentUsersTable />
                </div>
            </div>
        )}
    </div>
  );
}
