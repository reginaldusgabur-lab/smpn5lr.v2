'use client';

import { useMemo, useEffect, useState } from 'react';
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
import { Loader2, CalendarOff, LogIn, LogOut, ClipboardCheck, ArrowRight, FileText, UserCheck, AlertCircle, UserX, BookUser, MailWarning, Clock } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, Timestamp, getDocs, type DocumentData, collectionGroup, getDoc } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// LiveClock component fixed for hydration
function LiveClock() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
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
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-3/4 !mt-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
            <Card className="w-full lg:col-span-2 rounded-2xl">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-6 flex flex-col items-center justify-center pt-8">
                    <Skeleton className="h-[72px] w-1/2" />
                    <div className="grid grid-cols-2 gap-4 text-center w-full max-sm pt-4">
                        <Skeleton className="h-[88px] w-full" />
                        <Skeleton className="h-[88px] w-full" />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Skeleton className="h-11 w-full" />
                </CardFooter>
            </Card>
            <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="rounded-2xl">
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-1/4" />
                            <Skeleton className="h-3 w-3/4 mt-1" />
                        </CardContent>
                        { i > 0 && <CardFooter><Skeleton className="h-9 w-full" /></CardFooter> }
                    </Card>
                ))}
            </div>
        </div>
        <Card className="rounded-2xl">
            <CardHeader>
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
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


export default function KepalaSekolahDashboardPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);
  
  const isRoleLoading = isAuthLoading || isUserDataLoading;
  const isHeadmaster = !isRoleLoading && userData?.role === 'kepala_sekolah';
  
  const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
  const { data: schoolConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const todaysPersonalAttendanceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return query(
      collection(firestore, 'users', user.uid, 'attendanceRecords'),
      where('date', '==', todayStr)
    );
  }, [user, firestore]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysPersonalAttendanceQuery);
  
  const allUsersQuery = useMemoFirebase(() => (isHeadmaster && firestore) ? collection(firestore, 'users') : null, [firestore, isHeadmaster]);
  const { data: usersData, isLoading: isUsersLoading } = useCollection(user, allUsersQuery);
  
  const [dashboardData, setDashboardData] = useState({
    allAttendanceData: [] as DocumentData[],
    pendingLeaveRequests: [] as DocumentData[],
    stats: { hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0 }
  });
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(true);

  useEffect(() => {
    if (!isHeadmaster || !firestore || !usersData) {
        if (!isUsersLoading) setIsDashboardDataLoading(false);
        return;
    }

    const fetchDashboardData = async () => {
        setIsDashboardDataLoading(true);
        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            
            const attendanceQuery = collectionGroup(firestore, 'attendanceRecords');
            const leaveQuery = collectionGroup(firestore, 'leaveRequests');

            const [attendanceSnap, leaveSnap] = await Promise.all([
                getDocs(attendanceQuery),
                getDocs(leaveQuery),
            ]);
            
            const userMap = new Map(usersData.map(u => [u.id, u.role]));
            
            const allAttendance = attendanceSnap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .filter(att => {
                    const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : null);
                    const role = userMap.get(att.userId);
                    return dStr === todayStr && role && ['guru', 'kepala_sekolah', 'pegawai'].includes(role);
                });
            
            const allPendingLeave = leaveSnap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .filter(req => {
                    const role = userMap.get(req.userId);
                    return req.status === 'pending' && role && ['guru', 'kepala_sekolah', 'pegawai'].includes(role);
                });

            const presentIds = new Set(allAttendance.map(a => a.userId));
            
            setDashboardData({
                allAttendanceData: allAttendance,
                pendingLeaveRequests: allPendingLeave,
                stats: {
                    hadir: presentIds.size,
                    izin: 0,
                    sakit: 0,
                    pending: allPendingLeave.length,
                    alpa: 0
                }
            });
        } catch (error) {
            console.error("Dashboard error:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat data dasbor." });
        } finally {
            setIsDashboardDataLoading(false);
        }
    };

    fetchDashboardData();
  }, [isHeadmaster, firestore, isUsersLoading, usersData, toast]);

  const isLoading = isRoleLoading || isConfigLoading || isAttendanceLoading || isUsersLoading || isDashboardDataLoading;
  
  useEffect(() => {
    if (!isRoleLoading) {
        if (!user) {
          router.replace('/');
        } else if (!isHeadmaster) {
          router.replace('/dashboard');
        }
    }
  }, [isRoleLoading, isHeadmaster, router, user]);
  

  const isHoliday = useMemo(() => {
    if (!schoolConfig) return false;
    if (schoolConfig.isAttendanceActive === false) return true;
    const today = new Date();
    const offDays: number[] = schoolConfig.offDays ?? [0];
    if (offDays.includes(today.getDay())) return true;
    return false;
  }, [schoolConfig]);

  const { staffPresentToday, totalStaff, recentStaffAttendance } = useMemo(() => {
    const { allAttendanceData } = dashboardData;
    if (!usersData || !allAttendanceData || !isHeadmaster) {
      return { staffPresentToday: 0, totalStaff: 0, recentStaffAttendance: [] };
    }

    const userMap = new Map(usersData.map(u => [u.id, u]));
    const staffAndTeachers = usersData.filter(u => ['guru', 'kepala_sekolah', 'pegawai'].includes(u.role));
    const presentStaffIds = new Set(allAttendanceData.map(att => att.userId));
    
    const sortedRecentAttendance = [...allAttendanceData].sort((a, b) => {
        const timeA = a.checkInTime?.toDate().getTime() || a.checkOutTime?.toDate().getTime() || 0;
        const timeB = b.checkInTime?.toDate().getTime() || b.checkOutTime?.toDate().getTime() || 0;
        return timeA - timeB;
    });

    const enrichedRecentAttendance = sortedRecentAttendance.map((att, index) => {
        const isFinished = !!att.checkOutTime;
        return {
            ...att,
            sequence: index + 1,
            name: userMap.get(att.userId)?.name || 'Pengguna tidak dikenal',
            checkInTimeFormatted: att.checkInTime ? format(att.checkInTime.toDate(), 'HH:mm:ss') : '-',
            checkOutTimeFormatted: att.checkOutTime ? format(att.checkOutTime.toDate(), 'HH:mm:ss') : '-',
            status: isFinished ? 'Pulang' : 'Hadir',
            statusClass: isFinished ? 'bg-emerald-500' : 'bg-blue-600',
        };
    });

    return {
      totalStaff: staffAndTeachers.length,
      staffPresentToday: presentStaffIds.size,
      recentStaffAttendance: enrichedRecentAttendance,
    };
  }, [usersData, dashboardData, isHeadmaster]);

  if (isLoading || !isHeadmaster) {
    return <KepalaSekolahDashboardSkeleton />;
  }

  const personalButtonAction = () => {
    const record = todaysAttendance?.[0];
    const hasIn = !!record?.checkInTime;
    const hasOut = !!record?.checkOutTime;

    if (hasIn && !hasOut) {
        return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 active:scale-95 transition-all"><Link href="/dashboard/absen">Absen Pulang</Link></Button>;
    } else if (!hasIn) {
        return <Button asChild size="lg" className="w-full font-semibold rounded-xl h-12 active:scale-95 transition-all"><Link href="/dashboard/absen">Absen Masuk</Link></Button>;
    } else {
        return <Button disabled size="lg" className="w-full font-semibold rounded-xl h-12 active:scale-95 transition-all">Absensi Selesai</Button>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Selamat Datang</h1>
        <p className="text-lg text-muted-foreground">{userData?.name || 'Kepala Sekolah'}</p>
        <p className="text-muted-foreground !mt-2">Ini adalah dasbor pribadi dan ringkasan pemantauan Anda.</p>
      </div>

      {isHoliday && (
        <Alert className="bg-blue-50 border-blue-200 rounded-xl shadow-none">
          <CalendarOff className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 font-bold">Hari Libur Terdeteksi</AlertTitle>
          <AlertDescription className="text-blue-700 text-xs font-bold">Sistem absensi sedang non-aktif hari ini.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="w-full lg:col-span-2 shadow-none border-muted-foreground/10 bg-primary/5 rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle>Kehadiran Anda Hari Ini</CardTitle>
            <CardDescription>Status kehadiran dan jam absensi pribadi Anda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center justify-center pt-8">
            <LiveClock />
            <div className="grid grid-cols-2 gap-4 text-center w-full max-w-sm pt-4">
              <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                      <LogIn className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Absen Masuk</p>
                  </div>
                <p className="text-2xl font-bold text-foreground">
                  {todaysAttendance?.[0]?.checkInTime ? format(todaysAttendance[0].checkInTime.toDate(), 'HH:mm') : '--:--'}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                      <LogOut className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Absen Pulang</p>
                  </div>
                <p className="text-2xl font-bold text-foreground">
                  {todaysAttendance?.[0]?.checkOutTime ? format(todaysAttendance[0].checkOutTime.toDate(), 'HH:mm') : '--:--'}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {!isHoliday ? personalButtonAction() : (
               <div className="w-full p-4 bg-muted/30 rounded-xl text-center">
                  <p className="text-xs font-bold text-muted-foreground">Absensi pribadi dinonaktifkan hari ini</p>
               </div>
            )}
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-[#26c281] to-[#2ab7a8] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-normal opacity-80">Hadir</span>
                <UserCheck className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="text-3xl font-normal tracking-tight">
                {staffPresentToday}<span className="text-lg opacity-50">/{totalStaff}</span>
            </div>
          </Card>
          
          <Card className="bg-gradient-to-br from-[#00b0ff] to-[#007aff] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-normal opacity-80">Persetujuan Izin</span>
              <ClipboardCheck className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="flex items-center justify-between">
                <div className="text-3xl font-normal tracking-tight">{dashboardData.pendingLeaveRequests?.length || 0}</div>
                <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg font-normal text-[10px] text-white hover:bg-white/10">
                    <Link href="/dashboard/izin-kepala-sekolah">DETAIL</Link>
                </Button>
            </div>
          </Card>
          
           <Card className="bg-gradient-to-br from-[#ff9100] to-[#f39c12] border-none shadow-md rounded-xl overflow-hidden p-3 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-normal opacity-80">Laporan Sekolah</span>
              <FileText className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] opacity-70">Akses data</p>
                <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg font-normal text-[10px] text-white hover:bg-white/10">
                    <Link href="/dashboard/laporan-sekolah">BUKA</Link>
                </Button>
            </div>
          </Card>
        </div>
      </div>

      <Card className="shadow-none border-muted-foreground/10 overflow-hidden rounded-2xl bg-primary/5">
        <CardHeader className="bg-muted/20 border-b border-muted-foreground/5">
            <CardTitle className="text-lg font-bold">Riwayat Kehadiran Staf Terbaru</CardTitle>
            <CardDescription>Aktivitas kehadiran guru & pegawai yang tercatat hari ini.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-none">
                            <TableHead className="w-[50px] text-center font-bold text-[10px] uppercase tracking-widest border-none">No.</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest border-none">Nama</TableHead>
                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest border-none">Masuk</TableHead>
                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest border-none">Pulang</TableHead>
                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest border-none">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recentStaffAttendance.length > 0 ? (
                            recentStaffAttendance.map(item => (
                                <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                    <TableCell className="text-center font-bold text-muted-foreground text-xs">{item.sequence}</TableCell>
                                    <TableCell className="font-bold text-sm">{item.name}</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkInTimeFormatted}</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{item.checkOutTimeFormatted}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("text-[9px] font-bold uppercase px-3 py-1 rounded-full text-white border-none shadow-none", item.statusClass)}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest opacity-40">
                                    Belum ada aktivitas
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

