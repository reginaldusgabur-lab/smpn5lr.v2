
'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup, Timestamp, getCountFromServer } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { format, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, isBefore, isSameDay, setHours, setMinutes, parseISO } from 'date-fns';
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
    if (d === 'dinas pagi') return 'Dinas pagi';
    if (d === 'dinas siang') return 'Dinas siang';
    if (d === 'pulang cepat') return 'Pulang cepat';
    if (d === 'kegiatan luar sekolah') return 'Kegiatan luar sekolah';
    if (d.includes('admin') || d.includes('koreksi') || d.includes('lengkapi')) return 'Kehadiran penuh';
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

/**
 * Agregasi Statistik Harian (HANYA 1 READ PER QUERY)
 * Menggunakan getCountFromServer untuk efisiensi maksimal.
 */
export async function getDailyStaffAttendanceStats(firestore: Firestore) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const endOfToday = Timestamp.fromDate(endOfDay(today));

    try {
        const [configSnap, monthlySnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(today, 'yyyy-MM')))
        ]);
        const config = configSnap.data() || {};
        const mConfig = monthlySnap.data() || {};
        const isManualOff = config.isAttendanceActive === false;
        const isHoliday = isManualOff || (mConfig.holidays || []).includes(todayStr) || (config.offDays || [0, 6]).includes(today.getDay());

        // 1. Hitung Total Staf Aktif
        const qUsers = query(
            collection(firestore, 'users'), 
            where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']),
            where('status', '==', 'Aktif')
        );
        const countUsers = await getCountFromServer(qUsers);
        const totalStaff = countUsers.data().count;

        if (isHoliday) {
            return { totalStaff, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: true };
        }

        // 2. Hitung Staf Hadir Hari Ini
        const qPresent = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr));
        const countPresent = await getCountFromServer(qPresent);
        const hadirCount = countPresent.data().count;

        // 3. Hitung Izin & Sakit (Hanya yang status approved hari ini)
        const qLeave = query(
            collectionGroup(firestore, 'leaveRequests'),
            where('status', '==', 'approved'),
            where('startDate', '<=', endOfToday)
        );
        const leaveSnap = await getDocs(qLeave);
        const activeLeaves = leaveSnap.docs.filter(d => {
            const l = d.data();
            return isWithinInterval(today, { start: startOfDay(l.startDate.toDate()), end: endOfDay(l.endDate.toDate()) });
        });

        let izinCount = 0; let sakitCount = 0;
        activeLeaves.forEach(d => {
            const l = d.data();
            if (l.type === 'Sakit') sakitCount++;
            else if (!['Pulang Cepat', 'Dinas Siang'].includes(l.type)) izinCount++;
        });

        // 4. Hitung Pending Requests
        const qPending = query(collectionGroup(firestore, 'leaveRequests'), where('status', '==', 'pending'));
        const countPending = await getCountFromServer(qPending);

        // 5. Kalkulasi Alpa (Matematika klien untuk hemat reads)
        const alpaCount = Math.max(0, totalStaff - (hadirCount + izinCount + sakitCount));

        return { 
            totalStaff, 
            hadir: hadirCount, 
            izin: izinCount, 
            sakit: sakitCount, 
            pending: countPending.data().count, 
            alpa: alpaCount, 
            isHoliday: false 
        };
    } catch (e) {
        console.error("Aggregation stats error:", e);
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false };
    }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v401_${userId}_${format(start, 'yyyyMM')}`;
    const cached = getFromCache(cacheKey); if (cached) return cached;

    try {
        const [schoolConfigSnap, monthlyConfigSnap, attendanceSnap, leaveSnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(start, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);

        const schoolConfig = schoolConfigSnap.data() || {};
        const monthlyConfig = monthlyConfigSnap.data() || {};
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const workingDays = eachDayOfInterval({ start, end }).filter(day => 
            !(schoolConfig.offDays || [0, 6]).includes(day.getDay()) && 
            !(monthlyConfig.holidays || []).includes(format(day, 'yyyy-MM-dd'))
        );
        const workingDaysSet = new Set(workingDays.map(d => format(d, 'yyyy-MM-dd')));

        let totalPoints = 0; let hadirCount = 0; let izinCount = 0; let sakitCount = 0;
        const processedDates = new Set<string>();

        attendanceSnap.docs.forEach(d => {
            const att = d.data();
            const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr && workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                totalPoints += calculatePoints('hadir', cleanDesc(att.reasonForUpdate), !!att.checkInTime, !!att.checkOutTime);
                hadirCount++; processedDates.add(dStr);
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

        const pastWorkingDays = workingDays.filter(day => format(day, 'yyyy-MM-dd') <= todayStr);
        const alpaCount = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;

        const result = {
            totalHadir: hadirCount, totalIzin: izinCount, totalSakit: sakitCount, totalAlpa: alpaCount,
            totalPoints: totalPoints.toFixed(2),
            persentase: Math.min((totalPoints / (workingDays.length || 1)) * 100, 100).toFixed(1) + '%'
        };
        setInCache(cacheKey, result); return result;
    } catch (e) { return { totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, persentase: '0.0%' }; }
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
            eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).forEach(day => leaveMap.set(format(day, 'yyyy-MM-dd'), { ...l, id: d.id }));
        });
        const workingDays = eachDayOfInterval({ start, end }).filter(d => !(schoolConfig.offDays || [0, 6]).includes(d.getDay()) && !mConfig.holidays?.includes(format(d, 'yyyy-MM-dd')));
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        return workingDays.map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            if (dStr > todayStr) return null;
            const att = attMap.get(dStr); const leave = leaveMap.get(dStr);
            if (att) {
                const desc = cleanDesc(att.reasonForUpdate);
                return { id: att.id, date: dStr, checkInTime: att.checkInTime?.toDate().toISOString() || null, checkOutTime: att.checkOutTime?.toDate().toISOString() || null, status: 'Hadir', description: desc, points: calculatePoints('hadir', desc, !!att.checkInTime, !!att.checkOutTime), manualEntry: att.manualEntry || false };
            }
            if (leave) return { id: `${leave.id}-${dStr}`, date: dStr, status: leave.type, description: cleanDesc(leave.reason) || leave.type, points: calculatePoints(leave.type, leave.reason || leave.type, false, false), manualEntry: false };
            return { id: dStr, date: dStr, status: 'Alpa', description: 'Tanpa keterangan', points: 0.0, manualEntry: false };
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
