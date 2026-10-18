
'use server';

import { notFound } from 'next/navigation';
import { adminDb as firestore } from '@/lib/firebase-admin';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ReportClientShell from './ReportClientShell';
import { eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, format, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';
import { calculatePoints } from '@/lib/attendance';

const getMonthDate = (monthParam: string | undefined): Date => {
    if (monthParam) {
        const [year, month] = monthParam.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, 15));
    }
    return new Date();
};

export default async function UserReportDetailPage(props: { 
    params: Promise<{ userId: string }>,
    searchParams: Promise<{ month?: string }>
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    
    const { userId } = params;
    const currentMonth = getMonthDate(searchParams.month);

    try {
        const userRef = firestore.collection('users').doc(userId);
        const schoolConfigRef = firestore.collection('schoolConfig').doc('default');
        const monthlyConfigId = format(currentMonth, 'yyyy-MM');
        const monthlyConfigRef = firestore.collection('monthlyConfigs').doc(monthlyConfigId);

        const [userSnap, schoolConfigSnap, monthlyConfigSnap] = await Promise.all([
            userRef.get(),
            schoolConfigRef.get(),
            monthlyConfigRef.get(),
        ]);

        if (!userSnap.exists) {
            notFound();
        }

        const userData = userSnap.data()!;
        const schoolConfig = schoolConfigSnap.exists ? schoolConfigSnap.data()! : {};
        const monthlyConfig = monthlyConfigSnap.exists ? monthlyConfigSnap.data()! : {};

        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const today = startOfDay(new Date());

        const attendanceHistoryQuery = firestore
            .collection('users').doc(userId).collection('attendanceRecords')
            .where('date', '>=', format(monthStart, 'yyyy-MM-dd'))
            .where('date', '<=', format(monthEnd, 'yyyy-MM-dd'));

        const leaveHistoryQuery = firestore
            .collection('users').doc(userId).collection('leaveRequests')
            .where('status', '==', 'approved');

        const [attSnap, leaveSnap] = await Promise.all([
            attendanceHistoryQuery.get(),
            leaveHistoryQuery.get(),
        ]);
        
        const attendanceMap = new Map();
        attSnap.docs.forEach(d => {
            const data = d.data();
            const dStr = data.date;
            if (dStr) attendanceMap.set(dStr, { id: d.id, ...data });
        });

        const leaveMap = new Map<string, any>();
        leaveSnap.docs.forEach(d => {
            const leave = d.data();
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                if (isWithinInterval(day, { start: monthStart, end: monthEnd })) {
                    leaveMap.set(format(day, 'yyyy-MM-dd'), { ...leave, id: d.id });
                }
            });
        });

        const offDays: number[] = schoolConfig.offDays ?? [0, 6];
        const holidays: string[] = monthlyConfig.holidays ?? [];

        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        const report = allDaysInMonth.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, today);
            const isWorkingDay = !offDays.includes(day.getDay()) && !holidays.includes(dayStr);
            const attendanceRecord = attendanceMap.get(dayStr);
            const leaveRecord = leaveMap.get(dayStr);

            if (!isWorkingDay) return null;
            if (isBefore(today, day) && !isToday && !leaveRecord) return null;

            const dayOfWeek = day.getDay().toString();
            const dailyOut = (schoolConfig as any).dailyCheckOutTimes?.[dayOfWeek];
            const outEndTimeStr = dailyOut?.end || schoolConfig.checkOutEndTime || "16:00";
            const [hLimit, mLimit] = outEndTimeStr.split(':').map(Number);
            const outEndMinutes = hLimit * 60 + mLimit;
            const checkOutExpired = !isToday || (currentTimeMinutes > outEndMinutes);

            if (attendanceRecord) {
                const checkInTime = attendanceRecord.checkInTime?.toDate() || null;
                const checkOutTime = attendanceRecord.checkOutTime?.toDate() || null;
                let description = attendanceRecord.reasonForUpdate || 'Kehadiran penuh';

                if (checkInTime && schoolConfig.useTimeValidation && schoolConfig.checkInEndTime) {
                    const [h, m] = schoolConfig.checkInEndTime.split(':').map(Number);
                    const deadline = setMinutes(setHours(startOfDay(checkInTime), h), m);
                    if (checkInTime > deadline && !description.toLowerCase().includes('dinas')) {
                        description = 'Terlambat';
                    }
                }

                const sD = description.toLowerCase();
                const pts = calculatePoints('hadir', sD, !!checkInTime, !!checkOutTime, checkOutExpired);

                return { 
                    id: attendanceRecord.id, 
                    date: day, 
                    checkInTime, 
                    checkOutTime, 
                    status: sD.includes('luar sekolah') ? 'Izin' : 'Hadir', 
                    description,
                    points: pts,
                    manualEntry: attendanceRecord.manualEntry || false
                };
            }

            if (leaveRecord) {
                const type = (leaveRecord.type || '').toLowerCase();
                const pts = calculatePoints(leaveRecord.type, leaveRecord.reason || leaveRecord.type, false, false, false);

                return { 
                    id: `${leaveRecord.id}-${dayStr}`, 
                    date: day, 
                    checkInTime: null, 
                    checkOutTime: null, 
                    status: leaveRecord.type === 'Cuti Resmi' ? 'Cuti' : leaveRecord.type, 
                    description: leaveRecord.reason || leaveRecord.type,
                    points: pts,
                    manualEntry: false
                };
            }

            if (isToday || isBefore(day, today)) {
                return { 
                    id: dayStr, 
                    date: day, 
                    checkInTime: null, 
                    checkOutTime: null, 
                    status: 'Alpa', 
                    description: 'Tidak ada keterangan',
                    points: 0.0,
                    manualEntry: false
                };
            }

            return null;
        });

        const validReport = report.filter(Boolean) as any[];
        validReport.sort((a, b) => b.date.getTime() - a.date.getTime());

        const reportData = validReport.map(item => ({
            ...item,
            date: item.date.toISOString(),
            checkInTime: item.checkInTime ? item.checkInTime.toISOString() : null,
            checkOutTime: item.checkOutTime ? item.checkOutTime.toISOString() : null,
        }));

        return (
            <ReportClientShell 
                userId={userId}
                initialUserData={userData}
                initialReportData={reportData}
                initialMonth={currentMonth.toISOString()}
                initialSchoolConfig={schoolConfig}
                initialMonthlyConfig={monthlyConfig}
            />
        );

    } catch (error) {
        console.error("Error User Detail Report:", error);
        return <div className="p-4"><Alert variant="destructive"><AlertTitle>Gagal</AlertTitle><AlertDescription>Kesalahan server saat memuat data laporan.</AlertDescription></Alert></div>;
    }
}
