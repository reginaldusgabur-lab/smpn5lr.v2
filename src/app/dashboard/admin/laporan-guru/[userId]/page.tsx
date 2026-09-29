
'use server';

import { notFound } from 'next/navigation';
import { adminDb as firestore } from '@/lib/firebase-admin';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ReportClientShell from './ReportClientShell';
import { eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, format, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';

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
        const monthlyConfigRef = firestore.collection('monthlyConfigs', monthlyConfigId);

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

        const attendanceHistoryQuery = firestore
            .collection('users').doc(userId).collection('attendanceRecords')
            .where('checkInTime', '>=', monthStart)
            .where('checkInTime', '<=', monthEnd);
            
        const attendanceFallbackQuery = firestore
            .collection('users').doc(userId).collection('attendanceRecords')
            .where('date', '>=', format(monthStart, 'yyyy-MM-dd'))
            .where('date', '<=', format(monthEnd, 'yyyy-MM-dd'));

        const leaveHistoryQuery = firestore
            .collection('users').doc(userId).collection('leaveRequests')
            .where('status', '==', 'approved');

        const [attSnap, attFallbackSnap, leaveSnap] = await Promise.all([
            attendanceHistoryQuery.get(),
            attendanceFallbackQuery.get(),
            leaveHistoryQuery.get(),
        ]);
        
        const attendanceMap = new Map();
        [...attSnap.docs, ...attFallbackSnap.docs].forEach(d => {
            const data = d.data();
            const dayStr = data.date || (data.checkInTime ? format(data.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dayStr && !attendanceMap.has(dayStr)) attendanceMap.set(dayStr, { id: d.id, ...data });
        });

        const leaveMap = new Map<string, any>();
        leaveSnap.docs.forEach(d => {
            const leave = d.data();
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                if (isWithinInterval(day, { start: monthStart, end: monthEnd })) {
                    leaveMap.set(dayStr, { ...leave, id: d.id });
                }
            });
        });

        const today = startOfDay(new Date());
        const offDays: number[] = schoolConfig.offDays ?? [0, 6];
        const holidays: string[] = monthlyConfig.holidays ?? [];

        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const report = allDaysInMonth.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, today);
            const isWorkingDay = !offDays.includes(day.getDay()) && !holidays.includes(dayStr);
            const attendanceRecord = attendanceMap.get(dayStr);
            const leaveRecord = leaveMap.get(dayStr);

            if (!isWorkingDay) return null;
            if (isBefore(today, day) && !isToday) return null;

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

                // Penyesuaian keterangan absen lupa
                const lowerD = description.toLowerCase();
                if (!lowerD.includes('dinas') && !lowerD.includes('luar sekolah') && !lowerD.includes('cuti')) {
                    if (checkInTime && !checkOutTime && !lowerD.includes('cepat')) {
                        description = 'Belum absen pulang';
                    } else if (!checkInTime && checkOutTime && !lowerD.includes('terlambat')) {
                        description = 'Belum absen masuk';
                    }
                }

                const sD = description.toLowerCase();
                let pts = 0;
                if (sD.includes('dinas') || sD.includes('luar sekolah') || sD === 'kehadiran penuh' || sD.includes('cuti')) pts = 1.0;
                else if (sD.includes('telat') || sD.includes('terlambat') || sD.includes('cepat')) pts = 0.95;
                else if (checkInTime && checkOutTime) pts = 1.0;
                else pts = 0.5;

                return { 
                    id: attendanceRecord.id, 
                    date: dayStr, 
                    checkInTime: checkInTime ? checkInTime.toISOString() : null, 
                    checkOutTime: checkOutTime ? checkOutTime.toISOString() : null, 
                    status: 'Hadir', 
                    description,
                    points: pts,
                    manualEntry: attendanceRecord.manualEntry || false
                };
            }

            if (leaveRecord) {
                const pts = (leaveRecord.type === 'Sakit') ? 0.9 : ((leaveRecord.type === 'Cuti' || leaveRecord.type === 'Cuti Resmi') ? 1.0 : 0.7);
                return { 
                    id: `${leaveRecord.id}-${dayStr}`, 
                    date: dayStr, 
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
                    date: dayStr, 
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
        validReport.sort((a, b) => b.date.localeCompare(a.date));

        return (
            <ReportClientShell 
                userId={userId}
                initialUserData={userData}
                initialReportData={validReport}
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
