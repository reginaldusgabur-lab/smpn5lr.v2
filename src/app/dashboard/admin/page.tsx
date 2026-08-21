
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserCheck, Users, FileWarning, ShieldAlert, FileText, CalendarOff, Lock, UserX, BookUser, Clock, Calendar, UserCircle, LogIn, LogOut } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMemo, useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit, getDocs, type DocumentData, collectionGroup, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { startOfDay, endOfDay, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getDailyStaffAttendanceStats } from '@/lib/attendance';
import { cn } from '@/lib/utils';

const AdminDashboardSkeletons = () => (
    <div className="space-y-6">
        <div className="space-y-1">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-3/4 !mt-2" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
                <Card key={i} className="rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-1/4" />
                        <Skeleton className="h-3 w-3/4 mt-1" />
                    </CardContent>
                </Card>
            ))}
        </div>
        <Card className="rounded-xl">
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                         <div key={i} className="flex items-center space-x-4 p-2 border-b">
                            <Skeleton className="h-4 w-1/3 flex-1" />
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
);


export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isHoliday, setIsHoliday] = useState(false);
  const [isManualDisabled, setIsManualDisabled] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);

  const isRoleCheckLoading = isUserLoading || isUserDataLoading;
  const isAdmin = !isRoleCheckLoading && userData?.role === 'admin';

  // Personal Attendance Logic for Admin
  const personalAttendanceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr), limit(1));
  }, [user, firestore]);
  const { data: personalAttendance } = useCollection(user, personalAttendanceQuery);

  const personalCheckIn = useMemo(() => {
    const rec = personalAttendance?.[0];
    return rec?.checkInTime ? format(rec.checkInTime.toDate(), 'HH:mm') : null;
  }, [personalAttendance]);

  const personalCheckOut = useMemo(() => {
    const rec = personalAttendance?.[0];
    return rec?.checkOutTime ? format(rec.checkOutTime.toDate(), 'HH:mm') : null;
  }, [personalAttendance]);

  const allUsersQuery = useMemoFirebase(() => (isAdmin && firestore) ? collection(firestore, 'users') : null, [firestore, isAdmin]);
  const { data: usersData, isLoading: isUsersLoading } = useCollection(user, allUsersQuery);
  
  const [dashboardData, setDashboardData] = useState({
    allAttendanceData: [] as DocumentData[],
    pendingLeaveRequests: [] as DocumentData[],
    stats: { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0 }
  });
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin || !firestore || !usersData) {
        if (!isUsersLoading) setIsDashboardDataLoading(false);
        return;
    }

    const fetchDashboardData = async () => {
        setIsDashboardDataLoading(true);
        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const dailyStats = await getDailyStaffAttendanceStats(firestore);
            
            setIsManualDisabled(!!dailyStats.isManualDisabled);
            setIsHoliday(!!dailyStats.isHoliday);

            const attendanceQuery = collectionGroup(firestore, 'attendanceRecords');
            const leaveQuery = collectionGroup(firestore, 'leaveRequests');
            
            const [attendanceSnap, leaveSnap] = await Promise.all([
                getDocs(attendanceQuery),
                getDocs(leaveQuery)
            ]);

            const allAttendance = attendanceSnap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .filter(att => {
                    const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : null);
                    return dStr === todayStr;
                });

            const userMap = new Map(usersData.map(u => [u.id, u.role]));
            const allPendingLeave = leaveSnap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .filter(req => {
                    const userRole = userMap.get(req.userId);
                    return userRole && ['guru', 'kepala_sekolah', 'pegawai'].includes(userRole) && req.status === 'pending';
                });

            setDashboardData({
                allAttendanceData: allAttendance,
                pendingLeaveRequests: allPendingLeave,
                stats: {
                    hadir: dailyStats.hadir,
                    izin: dailyStats.izin,
                    sakit: dailyStats.sakit,
                    pending: dailyStats.pending,
                    alpa: dailyStats.alpa
                }
            });
        } catch (error) {
            console.error("Dashboard error:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat data aktivitas." });
        } finally {
            setIsDashboardDataLoading(false);
        }
    };

    fetchDashboardData();
  }, [isAdmin, firestore, usersData, isUsersLoading, toast]);
  
  useEffect(() => {
    if (!isRoleCheckLoading) {
      if (!user) { router.replace('/'); } 
      else if (!isAdmin) { router.replace('/dashboard'); }
    }
  }, [isRoleCheckLoading, user, isAdmin, router]);

  const recentUserActivity = useMemo(() => {
    if (!usersData || !dashboardData.allAttendanceData || !isAdmin) return [];
    const userMap = new Map(usersData.map(u => [u.id, u]));
    
    return [...dashboardData.allAttendanceData]
        .sort((a, b) => {
            const timeA = a.checkInTime?.toDate().getTime() || a.checkOutTime?.toDate().getTime() || 0;
            const timeB = b.checkInTime?.toDate().getTime() || b.checkOutTime?.toDate().getTime() || 0;
            return timeB - timeA;
        })
        .map((att, index) => {
            const userDoc = userMap.get(att.userId);
            const isFinished = !!att.checkOutTime;
            return {
                ...att,
                sequence: index + 1,
                name: userDoc?.name || 'Pengguna tidak dikenal',
                role: (userDoc?.role || 'user').replace('_', ' '),
                checkInTimeFormatted: att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm:ss') : '-',
                checkOutTimeFormatted: att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm:ss') : '-',
                status: isFinished ? 'Pulang' : 'Hadir',
                statusClass: isFinished ? 'bg-emerald-500' : 'bg-blue-600',
            };
        });
  }, [usersData, dashboardData.allAttendanceData, isAdmin]);

  if (isRoleCheckLoading || isUsersLoading || isDashboardDataLoading || !isAdmin) {
    return <AdminDashboardSkeletons />;
  }
  
  const isTemporaryAdmin = user?.email === 'admin@sekolah.sch.id';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Selamat Datang</h1>
          <p className="text-lg text-muted-foreground">{userData?.name || 'Admin'}</p>
          <p className="text-muted-foreground !mt-2">Ini adalah ringkasan data dan statistik sekolah.</p>
      </div>
      
       <div className="grid gap-6">
        {isTemporaryAdmin && (
            <Alert variant="default" className="bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200 rounded-xl">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="font-semibold">Langkah Keamanan Penting</AlertTitle>
                <AlertDescription>
                    Anda menggunakan akun sementara. Segera buat akun admin baru dengan email pribadi Anda.
                </AlertDescription>
            </Alert>
        )}
        
        {isManualDisabled ? (
            <Alert className="bg-amber-50 border-amber-200 rounded-xl">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 font-bold">Sistem Absensi Dinonaktifkan</AlertTitle>
                <AlertDescription className="text-amber-700">Sistem saat ini sedang dinonaktifkan secara manual oleh Administrator.</AlertDescription>
            </Alert>
        ) : isHoliday && (
            <Alert className="bg-blue-50 border-blue-200 rounded-xl">
                <CalendarOff className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-bold">Hari Libur Terdeteksi</AlertTitle>
                <AlertDescription className="text-blue-700">Sistem absensi non-aktif hari ini berdasarkan jadwal libur.</AlertDescription>
            </Alert>
        )}

        {/* Kehadiran Hari Ini Section (Added for Admin) */}
        <div className="space-y-1">
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
                    <div className="flex flex-col items-center justify-center">
                        <h2 className="text-5xl font-bold tracking-tighter tabular-nums text-foreground leading-none">
                            {format(currentTime, 'HH:mm:ss')}
                        </h2>
                        <p className="text-xs font-bold text-muted-foreground mt-3 uppercase tracking-wider opacity-60">
                            {format(currentTime, 'eeee, d MMMM yyyy', { locale: id })}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm mx-auto pt-4">
                        <div className="bg-green-500/5 rounded-2xl p-4 text-center border border-green-500/10 flex items-center gap-3 relative overflow-hidden">
                            <div className="absolute right-[-10px] top-[-10px] w-12 h-12 rounded-full bg-green-500/5" />
                            <div className="bg-green-500 p-2.5 rounded-full text-white shadow-lg shadow-green-500/20 shrink-0 relative z-10">
                                <LogIn className="h-4 w-4" />
                            </div>
                            <div className="text-left relative z-10">
                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none mb-1">Masuk</p>
                                <p className="text-xl font-bold tabular-nums text-foreground leading-none">
                                    {personalCheckIn || '--:--'}
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
                                    {personalCheckOut || '--:--'}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <Card className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest">Hadir</span>
                    <UserCheck className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">
                    {dashboardData.stats.hadir}
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest">Izin/Sakit</span>
                    <BookUser className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">
                    {dashboardData.stats.izin + dashboardData.stats.sakit}
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest">Menunggu</span>
                    <Clock className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">
                    {dashboardData.stats.pending}
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-[#ff5252] to-[#e74c3c] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-normal opacity-80 tracking-widest">Alpa</span>
                    <UserX className="h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="text-3xl font-normal tracking-tight">
                    {dashboardData.stats.alpa}
                </div>
            </Card>
        </div>

        <Card className="shadow-none overflow-hidden border-muted-foreground/10 bg-primary/5 rounded-xl">
            <CardHeader className="bg-muted/20 border-b border-muted-foreground/5">
                <CardTitle className="text-lg font-bold">Aktivitas Kehadiran Terbaru</CardTitle>
                <CardDescription>Daftar personil yang telah melakukan absensi hari ini.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-none">
                                <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase tracking-widest">No</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nama Personil</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Masuk</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-center">Pulang</TableHead>
                                <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentUserActivity.length > 0 ? recentUserActivity.map((item) => (
                                <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                    <TableCell className="text-center font-bold text-muted-foreground">{item.sequence}</TableCell>
                                    <TableCell>
                                        <div className="font-bold text-sm">{item.name}</div>
                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">{item.role}</div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkInTimeFormatted}</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkOutTimeFormatted}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("text-[9px] font-bold uppercase text-white border-none px-3 py-1 rounded-full", item.statusClass)}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold">Belum ada aktivitas kehadiran hari ini.</TableCell>
                                </TableRow>
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
