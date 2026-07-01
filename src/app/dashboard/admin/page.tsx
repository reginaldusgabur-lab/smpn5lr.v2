'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserCheck, Users, FileWarning, ShieldAlert, FileText, CalendarOff, Lock, UserX } from 'lucide-react';
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
import { doc, collection, query, where, Timestamp, getDocs, type DocumentData, collectionGroup, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { startOfDay, endOfDay, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const statusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'Hadir': 'default', 'Sakit': 'destructive', 'Izin': 'secondary', 'Terlambat': 'outline',
}

const AdminDashboardSkeletons = () => (
    <div className="space-y-6">
        <div className="space-y-1">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-3/4 !mt-2" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
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
            <div className="space-y-6">
                 {[...Array(3)].map((_, i) => (
                    <Card key={i}>
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
        </div>
    </div>
);


export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isHoliday, setIsHoliday] = useState(false);
  const [isManualDisabled, setIsManualDisabled] = useState(false);

  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);

  const isRoleCheckLoading = isUserLoading || isUserDataLoading;
  const isAdmin = !isRoleCheckLoading && userData?.role === 'admin';

  const allUsersQuery = useMemoFirebase(() => (isAdmin && firestore) ? collection(firestore, 'users') : null, [firestore, isAdmin]);
  const { data: usersData, isLoading: isUsersLoading } = useCollection(user, allUsersQuery);
  
  const [dashboardData, setDashboardData] = useState({
    allAttendanceData: [] as DocumentData[],
    pendingLeaveRequests: [] as DocumentData[],
  });
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin || !firestore) {
        setIsDashboardDataLoading(false);
        return;
    }

    if (!usersData) {
        if (!isUsersLoading) {
             setIsDashboardDataLoading(false);
        }
        return;
    }

    const fetchDashboardData = async () => {
        setIsDashboardDataLoading(true);
        
        try {
            const today = new Date();
            // Cek Konfigurasi Sekolah
            const schoolConfigSnap = await getDoc(doc(firestore, 'schoolConfig', 'default'));
            const schoolConfig = schoolConfigSnap.data();
            const monthlyConfigId = format(today, 'yyyy-MM');
            const monthlyConfigSnap = await getDoc(doc(firestore, 'monthlyConfigs', monthlyConfigId));
            const monthlyConfig = monthlyConfigSnap.data();

            const isManualOff = schoolConfig?.isAttendanceActive === false;
            setIsManualDisabled(isManualOff);

            const isHolidayToday = (() => {
                if (!schoolConfig) return false;
                if (isManualOff) return true; // Secara logika tombol manual mengesampingkan segalanya
                const todayStr = format(today, 'yyyy-MM-dd');
                if (monthlyConfig?.holidays?.includes(todayStr)) return true;
                const offDays: number[] = schoolConfig.offDays ?? [0, 6];
                return offDays.includes(today.getDay());
            })();

            setIsHoliday(isHolidayToday);

            const attendanceQuery = collectionGroup(firestore, 'attendanceRecords');
            const leaveQuery = collectionGroup(firestore, 'leaveRequests');
            
            const [attendanceSnap, leaveSnap] = await Promise.all([
                getDocs(attendanceQuery),
                getDocs(leaveQuery)
            ]);

            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());

            const allAttendance = attendanceSnap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .filter(att => {
                    const checkIn = att.checkInTime?.toDate();
                    return checkIn && checkIn >= todayStart && checkIn <= todayEnd;
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
            });
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            toast({
                variant: "destructive",
                title: "Gagal Memuat Data Dasbor",
                description: "Terjadi masalah izin saat mengambil data aktivitas terbaru.",
            });
        } finally {
            setIsDashboardDataLoading(false);
        }
    };

    fetchDashboardData();
  }, [isAdmin, firestore, usersData, isUsersLoading, toast]);
  
  // --- Auth & Role Check Effect ---
  useEffect(() => {
    if (!isRoleCheckLoading) {
      if (!user) {
        router.replace('/');
      } else if (!isAdmin) {
        router.replace('/dashboard');
      }
    }
  }, [isRoleCheckLoading, user, isAdmin, router]);

  // --- User Statistics Calculation ---
  const {
    totalUsers,
    kepalaSekolahCount,
    guruCount,
    pegawaiCount,
    siswaCount,
  } = useMemo(() => {
    if (!usersData || !isAdmin) {
      return { totalUsers: 0, kepalaSekolahCount: 0, guruCount: 0, pegawaiCount: 0, siswaCount: 0 };
    }
    const filteredUsers = usersData.filter(u => u.role !== 'admin');
    return {
      totalUsers: filteredUsers.length,
      kepalaSekolahCount: filteredUsers.filter(u => u.role === 'kepala_sekolah').length,
      guruCount: filteredUsers.filter(u => u.role === 'guru').length,
      pegawaiCount: filteredUsers.filter(u => u.role === 'pegawai').length,
      siswaCount: filteredUsers.filter(u => u.role === 'siswa').length,
    };
  }, [usersData, isAdmin]);

  // --- Combined Activity and Attendance Statistics Calculation ---
  const {
    staffPresentToday,
    totalStaff,
    recentUserActivity,
  } = useMemo(() => {
    const { allAttendanceData } = dashboardData;
    if (!usersData || !allAttendanceData || !isAdmin) {
      return { staffPresentToday: 0, totalStaff: 0, recentUserActivity: [] };
    }

    const userMap = new Map(usersData.map(u => [u.id, u]));
    
    const staffAndTeachers = usersData.filter(u => ['guru', 'kepala_sekolah', 'pegawai'].includes(u.role));
    const todaysStaffAttendance = allAttendanceData.filter(att => {
        const userDoc = userMap.get(att.userId);
        return userDoc && ['guru', 'kepala_sekolah', 'pegawai'].includes(userDoc.role);
    });
    const presentStaffIds = new Set(todaysStaffAttendance.map(att => att.userId));

    // SORT: Ascending (A - B) - First arrive = No 1
    const sortedRecentActivity = [...allAttendanceData].sort((a, b) => (a.checkInTime?.toDate().getTime() || 0) - (b.checkInTime?.toDate().getTime() || 0));

    const enrichedRecentActivity = sortedRecentActivity.map((att, index) => {
        const userDoc = userMap.get(att.userId);
        const role = userDoc?.role || 'tidak diketahui';
        const displayRole = role.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        return {
            ...att,
            id: att.id,
            sequence: index + 1,
            name: userDoc?.name || 'Pengguna tidak dikenal',
            role: displayRole,
            checkInTimeFormatted: att.checkInTime ? att.checkInTime.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
            checkOutTimeFormatted: att.checkOutTime ? att.checkOutTime.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
            status: 'Hadir',
        };
    });

    return {
      totalStaff: staffAndTeachers.length,
      staffPresentToday: presentStaffIds.size,
      recentUserActivity: enrichedRecentActivity,
    };
  }, [usersData, dashboardData, isAdmin]);


  // --- Render Logic ---
  const isDataLoading = isUsersLoading || isDashboardDataLoading;
  if (isRoleCheckLoading || isDataLoading || !isAdmin) {
    return <AdminDashboardSkeletons />;
  }
  
  const isTemporaryAdmin = user?.email === 'admin@sekolah.sch.id';
  const pendingLeaveRequestsCount = dashboardData.pendingLeaveRequests?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Selamat Datang</h1>
          <p className="text-lg text-muted-foreground">{userData?.name || 'Admin'}</p>
          <p className="text-muted-foreground !mt-2">Ini adalah ringkasan data dan statistik sekolah.</p>
      </div>
      
       <div className="grid gap-6">
        {isTemporaryAdmin && (
            <Alert variant="default" className="bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="font-semibold text-amber-950 dark:text-amber-300">Langkah Keamanan Penting</AlertTitle>
                <AlertDescription>
                    Anda menggunakan akun sementara. Segera buat akun admin baru dengan email pribadi Anda melalui menu <Link href="/dashboard/admin/users" className="font-bold underline hover:text-amber-700 dark:hover:text-amber-100">Manajemen Pengguna</Link> untuk mengamankan sistem.
                </AlertDescription>
            </Alert>
        )}
        
        {isManualDisabled ? (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 font-bold">Sistem Absensi Dinonaktifkan</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                    Sistem saat ini sedang dinonaktifkan secara manual oleh Administrator. Pengguna tidak dapat melakukan absensi.
                </AlertDescription>
            </Alert>
        ) : isHoliday && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <CalendarOff className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300 font-bold">Hari Libur Terdeteksi</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                    Sistem absensi non-aktif hari ini berdasarkan jadwal libur.
                </AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
             <Card className="shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Staf Hadir</CardTitle>
                    <UserCheck className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{staffPresentToday}<span className="text-xl font-normal text-muted-foreground">/{totalStaff}</span></div>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Tercatat masuk hari ini</p>
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Izin Tertunda</CardTitle>
                    <FileWarning className="h-5 w-5 text-amber-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{pendingLeaveRequestsCount}</div>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Menunggu persetujuan</p>
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Pengguna</CardTitle>
                    <Users className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{totalUsers}</div>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Personil aktif sistem</p>
                </CardContent>

             <Link href="/dashboard/admin/laporan-guru" className="h-full">
                <Card className="hover:bg-muted/50 transition-colors shadow-none h-full">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Laporan</CardTitle>
                        <FileText className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold text-blue-600">Akses Cepat</div>
                        <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Kelola laporan harian</p>
                    </CardContent>
                </Card>
            </Link>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-none rounded-xl overflow-hidden">
                <CardHeader className="bg-muted/20 border-b border-muted-foreground/5">
                    <CardTitle className="text-lg font-bold text-primary">Aktivitas Kehadiran Terbaru</CardTitle>
                    <CardDescription className="font-medium">Urutan kedatangan personil yang tercatat hari ini.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-none">
                                    <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase tracking-widest">No</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nama Personil</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Peran</TableHead>
                                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Masuk</TableHead>
                                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Pulang</TableHead>
                                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentUserActivity.length > 0 ? recentUserActivity.map((item) => (
                                    <TableRow key={item.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                        <TableCell className="text-center font-bold text-muted-foreground">{item.sequence}</TableCell>
                                        <TableCell className="font-bold text-sm">{item.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[9px] font-bold uppercase">{item.role}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-xs font-bold">{item.checkInTimeFormatted}</TableCell>
                                        <TableCell className="text-center font-mono text-xs font-bold">{item.checkOutTimeFormatted}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={statusVariant[item.status] || 'default'} className="text-[9px] font-bold uppercase">{item.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold">
                                            {isHoliday || isManualDisabled ? "Tidak ada aktivitas pada saat sistem non-aktif." : "Belum ada aktivitas kehadiran hari ini."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
    </div>
  );
}
