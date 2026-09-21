'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup, Timestamp, setHours, setMinutes, startOfDay, endOfDay, format, isBefore, isSameDay, isWithinInterval } from 'firebase/firestore';
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
    points: number;
}

const cleanDesc = (desc: any) => {
    if (!desc || typeof desc !== 'string') return 'Kehadiran penuh';
    const d = desc.toLowerCase();
    
    if (d === 'terlambat') return 'Terlambat';
    if (d === 'sakit') return 'Sakit';
    if (d === 'izin' || d === 'izin pribadi') return 'Izin pribadi';
    if (d === 'dinas pagi' || d === 'tugas dinas pagi') return 'Dinas pagi';
    if (d === 'dinas siang' || d === 'tugas dinas siang') return 'Dinas siang';
    if (d === 'pulang cepat' || d === 'izin pulang cepat') return 'Pulang cepat';
    if (d === 'kegiatan luar sekolah') return 'Kegiatan luar sekolah';

    if (d.includes('admin') || d.includes('koreksi') || d.includes('lengkapi')) {
        return 'Kehadiran penuh';
    }
    return desc.trim() || 'Kehadiran penuh';
};

const calculatePoints = (status: string, description: string, hasIn: boolean, hasOut: boolean): number => {
    const s = status.toLowerCase();
    const d = description.toLowerCase();

    if (d.includes('dinas') || d.includes('luar sekolah') || d === 'kehadiran penuh') return 1.0;
    if (hasIn && hasOut && s === 'hadir' && d !== 'terlambat' && !d.includes('cepat')) return 1.0;
    if (d === 'terlambat' || d.includes('cepat')) return 0.95;
    if (s === 'sakit') return 0.9;
    if (s.includes('izin')) return 0.7;
    if ((hasIn && !hasOut) || (!hasIn && hasOut)) return 0.5;
    return 0.0;
};

export async function getDailyStaffAttendanceStats(firestore: Firestore) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    try {
        const [schoolConfigSnap, monthlyConfigSnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(today, 'yyyy-MM')))
        ]);

        const schoolConfig = schoolConfigSnap.exists() ? schoolConfigSnap.data() : {};
        const monthlyConfig = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};

        const isManualOff = schoolConfig.isAttendanceActive === false;
        const holidays = monthlyConfig.holidays || [];
        const isCalendarHoliday = holidays.includes(todayStr);
        const dayOfWeek = today.getDay();
        const offDays: number[] = schoolConfig.offDays ?? [0, 6];
        const isRecurringOff = offDays.includes(dayOfWeek);

        const isHoliday = !isManualOff && (isCalendarHoliday || isRecurringOff);

        const usersQuery = query(collection(firestore, 'users'), where('status', '==', 'Aktif'));
        const usersSnap = await getDocs(usersQuery);
        // CRITICAL: Filter only ACTIVE staff
        const allStaff = usersSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(u => ['guru', 'pegawai', 'kepala_sekolah'].includes(u.role));

        if (isManualOff || isHoliday) {
            return { 
                totalStaff: allStaff.length, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, 
                isHoliday: isHoliday, isCalendarHoliday, isManualDisabled: isManualOff 
            };
        }

        const attendanceQuery = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr));
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
                    else izinCount++;
                } else {
                    pendingCount++;
                }
            } else {
                alpaCount++;
            }
        });

        return {
            totalStaff: allStaff.length, hadir: presentUserIds.size, izin: izinCount, sakit: sakitCount, pending: pendingCount, alpa: alpaCount,
            isHoliday: false, isManualDisabled: false, isCalendarHoliday: false
        };
    } catch (e) {
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false, isManualDisabled: false, isCalendarHoliday: false };
    }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v302_single_${userId}_${format(start, 'yyyyMM')}`;
    const cached = getFromCache(cacheKey); if (cached) return cached;

    try {
        const [configSnap, monthlySnap, attSnap, leaveSnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(start, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);

        const config = configSnap.data() || {};
        const mConfig = monthlySnap.data() || {};
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const workingDays = eachDayOfInterval({ start, end }).filter(day => 
            !(config.offDays || [0, 6]).includes(day.getDay()) && !mConfig.holidays?.includes(format(day, 'yyyy-MM-dd'))
        );

        const workingDaysSet = new Set(workingDays.map(day => format(day, 'yyyy-MM-dd')));
        let totalPoints = 0;
        let hadirCount = 0;
        let izinCount = 0;
        let sakitCount = 0;
        const processedDates = new Set<string>();

        attSnap.docs.forEach(d => {
            const att = d.data();
            const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (workingDaysSet.has(dStr)) {
                totalPoints += calculatePoints('hadir', att.reasonForUpdate || '', !!att.checkInTime, !!att.checkOutTime);
                hadirCount++;
                processedDates.add(dStr);
            }
        });

        leaveSnap.docs.forEach(d => {
            const leave = d.data();
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                    totalPoints += calculatePoints(leave.type, leave.reason || leave.type, false, false);
                    if (leave.type === 'Sakit') sakitCount++; else izinCount++;
                    processedDates.add(dStr);
                }
            });
        });

        const alpaCount = workingDays.filter(d => format(d, 'yyyy-MM-dd') <= todayStr && !processedDates.has(format(d, 'yyyy-MM-dd'))).length;
        const result = {
            totalHadir: hadirCount, totalIzin: izinCount, totalSakit: sakitCount, totalAlpa: alpaCount,
            totalPoints: totalPoints.toFixed(2),
            persentase: Math.min((totalPoints / (workingDays.length || 1)) * 100, 100).toFixed(1) + '%'
        };

        setInCache(cacheKey, result);
        return result;
    } catch (e) {
        return { totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, totalPoints: '0.00', persentase: '0.0%' };
    }
}

export async function fetchUserMonthlyReportData(firestore: Firestore, userId: string, currentMonth: Date, schoolConfig: any) {
    if (!schoolConfig) return [];
    const start = startOfMonth(currentMonth); const end = endOfMonth(currentMonth);

    try {
        const [mConfigSnap, attSnap, leaveSnap] = await Promise.all([
            getDoc(doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);

        const mConfig = mConfigSnap.data() || {};
        const attMap = new Map();
        attSnap.docs.forEach(d => {
            const data = d.data();
            const dStr = data.date || (data.checkInTime ? format(data.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr) attMap.set(dStr, { id: d.id, ...data });
        });

        const leaveMap = new Map();
        leaveSnap.docs.forEach(d => {
            const l = d.data();
            eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).forEach(day => leaveMap.set(format(day, 'yyyy-MM-dd'), l));
        });

        const workingDays = eachDayOfInterval({ start, end }).filter(d => !(schoolConfig.offDays || [0, 6]).includes(d.getDay()) && !mConfig.holidays?.includes(format(d, 'yyyy-MM-dd')));
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        return workingDays.map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            if (dStr > todayStr) return null;
            const att = attMap.get(dStr); const leave = leaveMap.get(dStr);

            if (att) {
                const hasIn = !!att.checkInTime, hasOut = !!att.checkOutTime;
                const pts = calculatePoints('hadir', att.reasonForUpdate || '', hasIn, hasOut);
                return { 
                    id: att.id, date: dStr, 
                    checkInTime: att.checkInTime?.toDate().toISOString() || null, 
                    checkOutTime: att.checkOutTime?.toDate().toISOString() || null,
                    status: 'Hadir', description: cleanDesc(att.reasonForUpdate), points: pts 
                };
            }
            if (leave) {
                const pts = calculatePoints(leave.type, leave.reason || leave.type, false, false);
                return { id: leave.id, date: dStr, status: leave.type, description: leave.reason || leave.type, points: pts };
            }
            return { id: dStr, date: dStr, status: 'Alpa', description: 'Tanpa Keterangan', points: 0 };
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
