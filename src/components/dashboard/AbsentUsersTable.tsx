'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, Timestamp, doc, getDoc } from 'firebase/firestore';
import { isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { Loader2, UserCheck, AlertCircle, CalendarOff } from 'lucide-react';

interface AbsentUser {
  no: number;
  name: string;
  nip: string;
  position: string;
  status: 'Alpa' | 'Menunggu Persetujuan' | 'Izin' | 'Sakit' | 'Dinas';
}

interface UserData {
  id: string;
  name: string;
  nip: string;
  role: string;
  position: string;
}

const AbsentUsersTable = () => {
  const [absentUsers, setAbsentUsers] = useState<AbsentUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHoliday, setIsHoliday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) {
      setIsLoading(false);
      return;
    }

    const findAbsentUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Date();
        const startOfToday = startOfDay(today);
        const endOfToday = endOfDay(today);

        // 1. Ambil Konfigurasi untuk cek hari libur
        const schoolConfigSnap = await getDoc(doc(firestore, 'schoolConfig', 'default'));
        const schoolConfig = schoolConfigSnap.data();
        
        const monthlyConfigId = format(today, 'yyyy-MM');
        const monthlyConfigSnap = await getDoc(doc(firestore, 'monthlyConfigs', monthlyConfigId));
        const monthlyConfig = monthlyConfigSnap.data();

        const isHolidayToday = (() => {
            if (!schoolConfig) return false;
            // Cek Mode Libur Manual
            if (schoolConfig.isAttendanceActive === false) return true;
            
            // Cek Hari Libur Spesifik (Nasional/Sekolah) dari Monthly Config
            const todayStr = format(today, 'yyyy-MM-dd');
            if (monthlyConfig?.holidays && Array.isArray(monthlyConfig.holidays)) {
                if (monthlyConfig.holidays.includes(todayStr)) return true;
            }
            
            // Cek Hari Libur Rutin (Minggu/Sabtu)
            const offDays: number[] = schoolConfig.offDays ?? [0, 6];
            return offDays.includes(today.getDay());
        })();

        setIsHoliday(isHolidayToday);

        // Jika hari libur, hentikan proses dan jangan tampilkan siapapun
        if (isHolidayToday) {
            setAbsentUsers([]);
            setIsLoading(false);
            return;
        }

        // 2. Jika bukan hari libur, cari siapa yang tidak hadir
        const usersQuery = query(collection(firestore, 'users'), where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']));
        const usersSnap = await getDocs(usersQuery);
        const allStaff: UserData[] = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));

        const attendanceQuery = query(
          collectionGroup(firestore, 'attendanceRecords'), 
          where('checkInTime', '>=', Timestamp.fromDate(startOfToday)),
          where('checkInTime', '<', Timestamp.fromDate(endOfToday))
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        const presentUserIds = new Set<string>();
        attendanceSnap.forEach(doc => {
          const userId = doc.data().userId || doc.ref.parent.parent?.id;
          if (userId) presentUserIds.add(userId);
        });

        const leaveQuery = query(collectionGroup(firestore, 'leaveRequests'));
        const leaveSnap = await getDocs(leaveQuery);
        const onLeaveOrPendingUserIds = new Map<string, {
            status: 'approved' | 'pending' | 'rejected'; 
            type: string;
        }>();

        leaveSnap.forEach(doc => {
          const leave = doc.data();
          const startDate = leave.startDate?.toDate();
          const endDate = leave.endDate?.toDate();

          if (startDate && endDate && isWithinInterval(today, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
            const userId = leave.userId || doc.ref.parent.parent?.id;
            if (userId) {
                // Prioritaskan status 'approved' jika ada duplikasi data
                if (!onLeaveOrPendingUserIds.has(userId) || leave.status === 'approved') {
                    onLeaveOrPendingUserIds.set(userId, { status: leave.status, type: leave.type });
                }
            }
          }
        });

        const usersToDisplay = allStaff
          .filter(user => !presentUserIds.has(user.id))
          .map((user, index) => {
            const leaveInfo = onLeaveOrPendingUserIds.get(user.id);
            let status: AbsentUser['status'] = 'Alpa';

            if(leaveInfo) {
                if(leaveInfo.status === 'approved') {
                    status = (leaveInfo.type as any) || 'Izin';
                } else if (leaveInfo.status === 'pending') {
                    status = 'Menunggu Persetujuan';
                }
            }
            
            return {
                no: index + 1,
                name: user.name,
                nip: user.nip || '-',
                position: user.position || 'Staf',
                status: status,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setAbsentUsers(usersToDisplay);

      } catch (e: any) {
        console.error("Error finding absent users:", e);
        setError("Gagal memuat daftar staf tidak hadir.");
      } finally {
        setIsLoading(false);
      }
    };

    findAbsentUsers();

  }, [firestore]);

  const EmptyState = () => {
      if(isLoading) return <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mb-3" /><span>Mencari data kehadiran...</span></div>;
      if(error) return <div className="flex flex-col items-center justify-center h-40 text-destructive text-center px-4"><AlertCircle className="h-8 w-8 mb-3" /><span>{error}</span></div>
      if(isHoliday) return <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><CalendarOff className="h-8 w-8 mb-3" /><span>Hari ini adalah hari libur. Sistem absensi dinonaktifkan.</span></div>;
      return <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><UserCheck className="h-8 w-8 mb-3" /><span>Semua staf telah melakukan absensi atau memiliki izin yang sah.</span></div>;
  }

  const getBadgeVariant = (status: string) => {
      switch(status) {
          case 'Alpa': return 'destructive';
          case 'Sakit': return 'destructive';
          case 'Izin': return 'secondary';
          case 'Dinas': return 'secondary';
          case 'Menunggu Persetujuan': return 'outline';
          default: return 'default';
      }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Staf Tidak Hadir Hari Ini</CardTitle>
        <CardDescription>Staf yang belum melakukan absensi masuk dan tidak memiliki izin yang disetujui.</CardDescription>
      </CardHeader>
      <CardContent>
        {!isHoliday && absentUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {absentUsers.map((user, index) => (
                    <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">NIP: {user.nip}</div>
                    </TableCell>
                    <TableCell>{user.position}</TableCell>
                    <TableCell className="text-center">
                        <Badge variant={getBadgeVariant(user.status)}>
                            {user.status}
                        </Badge>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
};

export default AbsentUsersTable;