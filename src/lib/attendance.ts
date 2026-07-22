'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup, Timestamp } from 'firebase/firestore';
import { eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, format, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
import type { Firestore } from 'firebase/firestore';
import { getFromCache, setInCache } from './cache';

export interface MonthlyReportData {
    id: string;
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
    description: string;
    manualEntry: boolean;
}

const cleanDesc = (desc: string) => {
    if (!desc) return 'Kehadiran penuh';
    const d = desc.toLowerCase();
    
    if (d === 'terlambat') return 'Terlambat';
    if (d === 'sakit') return 'Sakit';
    if (d === 'izin' || d === 'izin pribadi') return 'Izin pribadi';
    if (d === 'dinas pagi') return 'Dinas pagi';
    if (d === 'dinas siang') return 'Dinas siang';
    if (d === 'pulang cepat') return 'Pulang cepat';

    if (d.includes('admin') || d.includes('koreksi') || d.includes('lengkapi') || d.includes('diubah oleh admin')) {
        return 'Kehadiran penuh';
    }
    return desc.trim() || 'Kehadiran penuh';
};

export async function getDailyStaffAttendanceStats(firestore: Firestore) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const cacheKey = `daily_stats_v150_${todayStr}`;
    
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return cachedData;

    try {
        const schoolConfigRef = doc(firestore, 'schoolConfig', 'default');
        const monthlyConfigId = format(today, 'yyyy-MM');
        const monthlyConfigRef = doc(firestore, 'monthlyConfigs', monthlyConfigId);

        const [schoolConfigSnap, monthlyConfigSnap] = await Promise.all([
            getDoc(schoolConfigRef),
            getDoc(monthlyConfigRef)
        ]);

        const schoolConfig = schoolConfigSnap.data();
        const monthlyConfig = monthlyConfigSnap.data();

        const isManualOff = schoolConfig?.isAttendanceActive === false;
        const isCalendarHoliday = monthlyConfig?.holidays?.includes(todayStr);
        const dayOfWeek = today.getDay();
        const offDays: number[] = schoolConfig?.offDays ?? [0, 6];
        const isRecurringOff = offDays.includes(dayOfWeek);

        const isHoliday = !isManualOff && (isCalendarHoliday || isRecurringOff);

        if (isManualOff || isHoliday) {
            return { 
                totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, 
                isHoliday: isHoliday, 
                isCalendarHoliday: isCalendarHoliday,
                isManualDisabled: isManualOff 
            };
        }

        const usersQuery = query(
            collection(firestore, 'users'), 
            where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']),
            where('status', '==', 'Aktif')
        );
        const usersSnap = await getDocs(usersQuery);
        const allStaff = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const attendanceQuery = query(
            collectionGroup(firestore, 'attendanceRecords'),
            where('date', '==', todayStr)
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        const presentUserIds = new Set<string>();
        attendanceSnap.forEach(doc => {
            const data = doc.data();
            const userId = data.userId || doc.ref.parent.parent?.id;
            if (userId) presentUserIds.add(userId);
        });

        const leaveQuery = query(collectionGroup(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'pending']));
        const leaveSnap = await getDocs(leaveQuery);
        
        let izinCount = 0;
        let sakitCount = 0;
        let pendingCount = 0;
        let alpaCount = 0;

        allStaff.forEach((u: any) => {
            if (presentUserIds.has(u.id)) return;

            const userLeaves = leaveSnap.docs.filter(d => (d.data().userId || d.ref.parent.parent?.id) === u.id);
            const activeLeave = userLeaves.find(d => {
                const leave = d.data();
                return isWithinInterval(today, { start: startOfDay(leave.startDate.toDate()), end: endOfDay(leave.endDate.toDate()) });
            });

            if (activeLeave) {
                const leave = activeLeave.data();
                if (leave.status === 'approved') {
                    if (leave.type === 'Sakit') sakitCount++;
                    else if (leave.type !== 'Pulang Cepat') izinCount++;
                } else if (leave.status === 'pending' && leave.type !== 'Pulang Cepat') {
                    pendingCount++;
                }
            } else {
                alpaCount++;
            }
        });

        const result = {
            totalStaff: allStaff.length,
            hadir: presentUserIds.size,
            izin: izinCount,
            sakit: sakitCount,
            pending: pendingCount,
            alpa: alpaCount,
            isHoliday: false,
            isManualDisabled: false
        };

        setInCache(cacheKey, result);
        return result;
    } catch (e) {
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false, isManualDisabled: false };
    }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v150_${userId}_${format(start, 'yyyyMM')}`;
    
    const cachedStats = getFromCache(cacheKey);
    if (cachedStats) return cachedStats;

    try {
        const schoolConfigRef = doc(firestore, 'schoolConfig', 'default');
        const monthlyConfigId = format(start, 'yyyy-MM');
        const monthlyConfigRef = doc(firestore, 'monthlyConfigs', monthlyConfigId);
        
        const [schoolConfigSnap, monthlyConfigSnap, attendanceSnap, leaveSnap] = await Promise.all([
            getDoc(schoolConfigRef),
            getDoc(monthlyConfigRef),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);

        const schoolConfig = schoolConfigSnap.data();
        const monthlyConfig = monthlyConfigSnap.data();
        
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const attendanceData = attendanceSnap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .filter((att: any) => {
                const d = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
                return d >= startStr && d <= endStr;
            });

        const leaveData = leaveSnap.docs
            .map(d => d.data())
            .filter((l: any) => l.startDate.toDate() <= end);

        const offDays: number[] = schoolConfig?.offDays ?? [0, 6];
        const holidays: string[] = monthlyConfig?.holidays ?? [];

        const workingDaysInPeriod = eachDayOfInterval({ start, end }).filter(day => 
            !offDays.includes(day.getDay()) && !holidays.includes(format(day, 'yyyy-MM-dd'))
        );

        const workingDaysSet = new Set(workingDaysInPeriod.map(day => format(day, 'yyyy-MM-dd')));
        
        let totalPoints = 0;
        let hadirCount = 0;
        let izinCount = 0;
        let sakitCount = 0;
        const processedDates = new Set<string>();

        attendanceData.forEach((att: any) => {
            const attDateStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (attDateStr && workingDaysSet.has(attDateStr) && !processedDates.has(attDateStr)) {
                let point = 0;
                const desc = (att.reasonForUpdate || '').toLowerCase();
                
                if (desc.includes('dinas') || desc.includes('kehadiran penuh')) {
                    point = 1.0;
                } else if (desc.includes('terlambat') || desc.includes('pulang cepat')) {
                    point = 0.95;
                } else if (att.checkInTime && att.checkOutTime) {
                    point = 1.0;
                } else if (att.checkInTime || att.checkOutTime) {
                    point = 0.5;
                }
                
                totalPoints += point;
                hadirCount++;
                processedDates.add(attDateStr);
            }
        });

        leaveData.forEach(leave => {
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dayStr) && !processedDates.has(dayStr)) {
                    let point = 0;
                    if (leave.type === 'Sakit') {
                        point = 0.9;
                        sakitCount++;
                    } else if (leave.type === 'Izin' || leave.type === 'Izin Pribadi') {
                        point = 0.7;
                        izinCount++;
                    } else {
                        point = 1.0;
                        hadirCount++;
                    }
                    totalPoints += point;
                    processedDates.add(dayStr);
                }
            });
        });

        const pastWorkingDays = workingDaysInPeriod.filter(day => format(day, 'yyyy-MM-dd') <= todayStr);
        const alpaCount = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;
        
        const denominator = Math.max(1, workingDaysInPeriod.length);
        const finalPercentage = (totalPoints / denominator) * 100;

        const result = {
            totalHadir: hadirCount, 
            totalIzin: izinCount,
            totalSakit: sakitCount,
            totalAlpa: alpaCount,
            persentase: Math.min(finalPercentage, 100).toFixed(1) + '%',
        };

        setInCache(cacheKey, result);
        return result;
    } catch (e) {
        return { totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, persentase: '0.0%' };
    }
}

export async function fetchUserMonthlyReportData(firestore: Firestore, userId: string, currentMonth: Date, schoolConfig: any) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    try {
        const monthlyConfigId = format(currentMonth, 'yyyy-MM');
        const monthlyConfigRef = doc(firestore, 'monthlyConfigs', monthlyConfigId);
        
        const [monthlyConfigSnap, attendanceHistorySnap, leaveHistorySnap] = await Promise.all([
            getDoc(monthlyConfigRef),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);

        const monthlyConfig = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};
        
        const startStr = format(monthStart, 'yyyy-MM-dd');
        const endStr = format(monthEnd, 'yyyy-MM-dd');

        const attendanceHistory = attendanceHistorySnap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .filter((att: any) => {
                const d = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
                return d >= startStr && d <= endStr;
            });

        const leaveHistory = leaveHistorySnap.docs
            .map(d => d.data())
            .filter((l: any) => l.startDate.toDate() <= monthEnd);

        const now = new Date();
        const todayStart = startOfDay(now);
        const offDays = schoolConfig?.offDays ?? [0, 6];
        const holidays = monthlyConfig?.holidays ?? [];

        const attendanceMap = new Map();
        attendanceHistory.forEach((rec: any) => {
            const dStr = rec.date || (rec.checkInTime ? format(rec.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr) attendanceMap.set(dStr, rec);
        });

        const leaveMap = new Map<string, any>();
        leaveHistory.forEach(leave => {
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (dStr >= startStr && dStr <= endStr) {
                    leaveMap.set(dStr, leave);
                }
            });
        });

        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const report = allDaysInMonth.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, todayStart);
            const isWorkingDay = !offDays.includes(day.getDay()) && !holidays.includes(dayStr);

            if (!isWorkingDay) return null;

            if (isBefore(todayStart, day) && !isToday) {
                return null;
            }

            const attendanceRecord = attendanceMap.get(dayStr) as any;
            const leaveRecord = leaveMap.get(dayStr);

            if (attendanceRecord) {
                const checkInTime = attendanceRecord.checkInTime?.toDate() || null;
                const checkOutTime = attendanceRecord.checkOutTime?.toDate() || null;
                const isManual = attendanceRecord.manualEntry || false;
                
                let description = attendanceRecord.reasonForUpdate || 'Kehadiran penuh';
                
                const specialStatuses = ['dinas pagi', 'dinas siang', 'pulang cepat', 'sakit', 'izin', 'izin pribadi'];
                
                if (checkInTime && checkOutTime && !specialStatuses.includes(description.toLowerCase())) {
                    if (schoolConfig.useTimeValidation && schoolConfig.checkInEndTime) {
                        const [h, m] = schoolConfig.checkInEndTime.split(':').map(Number);
                        const deadline = setMinutes(setHours(startOfDay(checkInTime), h), m);
                        if (checkInTime > deadline) {
                            description = 'Terlambat';
                        } else {
                            description = 'Kehadiran penuh';
                        }
                    } else {
                        description = 'Kehadiran penuh';
                    }
                }
                
                description = cleanDesc(description);

                const importantStatuses = ['dinas pagi', 'dinas siang', 'pulang cepat', 'terlambat'];
                if (importantStatuses.includes(description.toLowerCase())) {
                    const statusLabel = description.charAt(0).toUpperCase() + description.slice(1);
                    return { id: attendanceRecord.id, date: day, checkInTime, checkOutTime, status: statusLabel, description: statusLabel, manualEntry: isManual };
                }

                if (!checkInTime && checkOutTime) {
                    return { id: attendanceRecord.id, date: day, checkInTime: null, checkOutTime, status: 'Hadir', description: 'Belum absen masuk', manualEntry: isManual };
                }

                return { 
                    id: attendanceRecord.id, date: day, checkInTime, checkOutTime, 
                    status: 'Hadir', 
                    description: !checkOutTime && isToday ? 'Belum absen pulang' : (isBefore(day, todayStart) && !checkOutTime ? 'Belum absen pulang' : description), 
                    manualEntry: isManual 
                };
            }

            if (leaveRecord && leaveRecord.type !== 'Pulang Cepat') {
                return { id: `${leaveRecord.id}-${dayStr}`, date: day, checkInTime: null, checkOutTime: null, status: leaveRecord.type, description: cleanDesc(leaveRecord.reason) || leaveRecord.type };
            }

            return { id: dayStr, date: day, checkInTime: null, checkOutTime: null, status: 'Alpa', description: 'Tidak ada keterangan' };
        });

        return report.filter(Boolean).sort((a: any, b: any) => b.date.getTime() - a.date.getTime()).map((item: any) => ({
            ...item,
            date: item.date.toISOString(),
            checkInTime: item.checkInTime ? item.checkInTime.toISOString() : null,
            checkOutTime: item.checkOutTime ? item.checkOutTime.toISOString() : null,
        }));
    } catch (e) {
        console.error("Fetch report error:", e);
        return [];
    }
}
