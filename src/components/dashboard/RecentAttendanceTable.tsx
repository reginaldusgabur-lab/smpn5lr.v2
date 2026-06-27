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
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { Loader2, WifiOff, AlertCircle, CalendarOff } from 'lucide-react';

interface Activity {
  no: number;
  name: string;
  nip: string;
  checkInTime: string;
  checkOutTime: string;
  rawCheckInTime: Date | null;
  status: 'Hadir' | 'Pulang';
  keterangan: string;
}

const RecentAttendanceTable = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHoliday, setIsHoliday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) {
      setIsLoading(false);
      return;
    }

    const fetchActivities = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Date();
        const startOfToday = startOfDay(today);
        const endOfToday = endOfDay(today);

        // 1. Fetch Configs to check for Holiday
        const schoolConfigSnap = await getDoc(doc(firestore, 'schoolConfig', 'default'));
        const schoolConfig = schoolConfigSnap.data();
        
        const monthlyConfigId = format(today, 'yyyy-MM');
        const monthlyConfigSnap = await getDoc(doc(firestore, 'monthlyConfigs', monthlyConfigId));
        const monthlyConfig = monthlyConfigSnap.data();

        const isHolidayToday = (() => {
            if (!schoolConfig) return false;
            if (schoolConfig.isAttendanceActive === false) return true;
            const todayStr = format(today, 'yyyy-MM-dd');
            if (monthlyConfig?.holidays?.includes(todayStr)) return true;
            const offDays: number[] = schoolConfig.offDays ?? [0, 6];
            return offDays.includes(today.getDay());
        })();

        setIsHoliday(isHolidayToday);

        if (isHolidayToday) {
            setActivities([]);
            setIsLoading(false);
            return;
        }

        const attendanceQuery = query(
          collectionGroup(firestore, 'attendanceRecords'),
          where('checkInTime', '>=', Timestamp.fromDate(startOfToday)),
          where('checkInTime', '<', Timestamp.fromDate(endOfToday))
        );

        const attendanceSnap = await getDocs(attendanceQuery);
        const activitiesData: Omit<Activity, 'no'>[] = [];

        for (const attendanceDoc of attendanceSnap.docs) {
          const attendanceData = attendanceDoc.data();
          const userId = attendanceDoc.ref.parent.parent?.id;

          if (userId) {
            const userRef = doc(firestore, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              const userData = userSnap.data();
              const checkInDate = attendanceData.checkInTime ? attendanceData.checkInTime.toDate() : null;
              
              activitiesData.push({
                name: userData.name || '-',
                nip: userData.nip || '-',
                rawCheckInTime: checkInDate,
                checkInTime: checkInDate ? format(checkInDate, 'HH:mm:ss') : '-',
                checkOutTime: attendanceData.checkOutTime ? format(attendanceData.checkOutTime.toDate(), 'HH:mm:ss') : '-',
                status: attendanceData.checkOutTime ? 'Pulang' : 'Hadir',
                keterangan: attendanceData.checkOutTime ? 'Kehadiran Penuh' : 'Masih di tempat',
              });
            }
          }
        }

        const sortedActivities = activitiesData.sort((a, b) => {
            if (a.rawCheckInTime && b.rawCheckInTime) {
                return a.rawCheckInTime.getTime() - b.rawCheckInTime.getTime();
            }
            return 0;
        });

        const finalActivities = sortedActivities.map((activity, index) => ({
            ...activity,
            no: index + 1,
        }));

        setActivities(finalActivities);

      } catch (e: any) {
        console.error("Error fetching today's activity:", e);
        if (e.code === 'failed-precondition') {
            setError("Database memerlukan indeks. Silakan buat indeks komposit dari link di log error konsol.");
        } else {
            setError("Gagal memuat aktivitas hari ini.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [firestore]);

  const todayFormatted = format(new Date(), "d MMMM yyyy", { locale: indonesiaLocale });

  const EmptyState = () => {
    if (isHoliday) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center px-4">
                <CalendarOff className="w-12 h-12 mb-4" />
                <h3 className="text-xl font-semibold">Hari Libur</h3>
                <p>Sistem absensi tidak aktif pada hari libur.</p>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center px-4">
            <WifiOff className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold">Belum Ada Aktivitas</h3>
            <p>Belum ada staf yang melakukan absensi masuk hari ini.</p>
        </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitas Kehadiran Hari Ini</CardTitle>
        <CardDescription>Daftar absensi pada tanggal {todayFormatted}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span>Memuat aktivitas...</span>
          </div>
        ) : error ? (
             <div className="flex flex-col items-center justify-center h-40 text-destructive text-center px-4">
                <AlertCircle className="w-8 h-8 mb-3" />
                <span className='font-medium'>Terjadi Kesalahan</span>
                <span>{error}</span>
            </div>
        ) : activities.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Jam Masuk</TableHead>
                <TableHead>Jam Pulang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                     <div className="font-medium">{activity.name}</div>
                    <div className="text-sm text-muted-foreground">NIP: {activity.nip}</div>
                  </TableCell>
                  <TableCell>{activity.checkInTime}</TableCell>
                  <TableCell>{activity.checkOutTime}</TableCell>
                   <TableCell>
                    <Badge variant={activity.status === 'Hadir' ? 'default' : 'secondary'}>
                        {activity.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{activity.keterangan}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
};

export default RecentAttendanceTable;
