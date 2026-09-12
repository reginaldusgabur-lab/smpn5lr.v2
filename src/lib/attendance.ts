
'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, format, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
import type { Firestore } from 'firebase/firestore';
import { getFromCache, setInCache } from './cache';

export interface MonthlyReportData {
    id: string;
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    s2CheckInTime: string | null;
    s2CheckOutTime: string | null;
    status: string;
    description: string;
    manualEntry: boolean;
    points: number;
}

const cleanDesc = (desc: any) => {
    if (!desc || typeof desc !== 'string') return 'Kehadiran penuh';
    const d = desc.toLowerCase();
    if (d.includes('admin') || d.includes('koreksi') || d.includes('lengkapi')) return 'Kehadiran penuh';
    return desc.trim() || 'Kehadiran penuh';
};

const calculatePoints = (status: string, description: string, s1In: boolean, s1Out: boolean, s2In: boolean, s2Out: boolean, isSesi2Active: boolean): number => {
    const d = description.toLowerCase();
    if (d.includes('dinas') || d.includes('luar sekolah') || d === 'kehadiran penuh') return 1.0;
    
    if (isSesi2Active) {
        // Logika Poin Sesi Ganda: Max 1.0
        // Sesi 1 (0.5) + Sesi 2 (0.5)
        let p = 0;
        if (s1In && s1Out) p += 0.5; else if (s1In || s1Out) p += 0.25;
        if (s2In && s2Out) p += 0.5; else if (s2In || s2Out) p += 0.25;
        
        if (status.toLowerCase() === 'sakit') return 0.9;
        if (status.toLowerCase().includes('izin')) return 0.7;
        return p;
    } else {
        // Logika Standar (Sesi 1 Saja)
        if (s1In && s1Out) return 1.0;
        if (s1In || s1Out) return 0.5;
        if (status.toLowerCase() === 'sakit') return 0.9;
        if (status.toLowerCase().includes('izin')) return 0.7;
        return 0;
    }
};

export async function getDailyStaffAttendanceStats(firestore: Firestore) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    try {
        const [schoolConfigSnap, monthlyConfigSnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(today, 'yyyy-MM')))
        ]);
        const schoolConfig = schoolConfigSnap.data() || {};
        const monthlyConfig = monthlyConfigSnap.data() || {};
        if (schoolConfig.isAttendanceActive === false || (schoolConfig.offDays || [0, 6]).includes(today.getDay()) || monthlyConfig.holidays?.includes(todayStr)) {
            return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: true, isManualDisabled: schoolConfig.isAttendanceActive === false };
        }
        const usersSnap = await getDocs(collection(firestore, 'users'));
        const allStaff = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(u => ['guru', 'pegawai', 'kepala_sekolah'].includes(u.role));
        const attendanceSnap = await getDocs(query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr)));
        const presentIds = new Set(attendanceSnap.docs.map(d => d.data().userId));
        return { totalStaff: allStaff.length, hadir: presentIds.size, izin: 0, sakit: 0, pending: 0, alpa: allStaff.length - presentIds.size, isHoliday: false, isManualDisabled: false };
    } catch (e) { return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false, isManualDisabled: false }; }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_s2_toggled_v1_${userId}_${format(start, 'yyyyMM')}`;
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
        const isSesi2Active = !!config.isSesi2Active;

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const workingDays = eachDayOfInterval({ start, end }).filter(d => !(config.offDays || [0, 6]).includes(d.getDay()) && !mConfig.holidays?.includes(format(d, 'yyyy-MM-dd')));
        const workingDaysSet = new Set(workingDays.map(d => format(d, 'yyyy-MM-dd')));

        let totalPoints = 0;
        const processedDates = new Set<string>();

        attSnap.docs.forEach(d => {
            const att = d.data();
            const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (workingDaysSet.has(dStr)) {
                totalPoints += calculatePoints('hadir', att.reasonForUpdate || '', !!att.checkInTime, !!att.checkOutTime, !!att.s2CheckInTime, !!att.s2CheckOutTime, isSesi2Active);
                processedDates.add(dStr);
            }
        });

        leaveSnap.docs.forEach(d => {
            const leave = d.data();
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                    totalPoints += calculatePoints(leave.type, leave.reason || leave.type, false, false, false, false, isSesi2Active);
                    processedDates.add(dStr);
                }
            });
        });

        const result = { totalPoints: totalPoints.toFixed(2), persentase: Math.min((totalPoints / (workingDays.length || 1)) * 100, 100).toFixed(1) + '%', totalAlpa: workingDays.filter(d => format(d, 'yyyy-MM-dd') <= todayStr && !processedDates.has(format(d, 'yyyy-MM-dd'))).length };
        setInCache(cacheKey, result); return result;
    } catch (e) { return { totalPoints: '0.00', persentase: '0.0%', totalAlpa: 0 }; }
}

export async function fetchUserMonthlyReportData(firestore: Firestore, userId: string, currentMonth: Date, schoolConfig: any) {
    if (!schoolConfig) return [];
    const start = startOfMonth(currentMonth); const end = endOfMonth(currentMonth);
    const isSesi2Active = !!schoolConfig.isSesi2Active;

    try {
        const [mConfigSnap, attSnap, leaveSnap] = await Promise.all([
            getDoc(doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);
        const mConfig = mConfigSnap.data() || {};
        const attMap = new Map();
        attSnap.docs.forEach(d => {
            const data = d.data(); const dStr = data.date || (data.checkInTime ? format(data.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr) attMap.set(dStr, { id: d.id, ...data });
        });
        const leaveMap = new Map();
        leaveSnap.docs.forEach(d => {
            const l = d.data(); eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).forEach(day => leaveMap.set(format(day, 'yyyy-MM-dd'), l));
        });

        const workingDays = eachDayOfInterval({ start, end }).filter(d => !(schoolConfig.offDays || [0, 6]).includes(d.getDay()) && !mConfig.holidays?.includes(format(d, 'yyyy-MM-dd')));
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        return workingDays.map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            if (dStr > todayStr) return null;
            const att = attMap.get(dStr); const leave = leaveMap.get(dStr);
            if (att) {
                const pts = calculatePoints('hadir', att.reasonForUpdate || '', !!att.checkInTime, !!att.checkOutTime, !!att.s2CheckInTime, !!att.s2CheckOutTime, isSesi2Active);
                return { id: att.id, date: dStr, checkInTime: att.checkInTime?.toDate().toISOString() || null, checkOutTime: att.checkOutTime?.toDate().toISOString() || null, s2CheckInTime: att.s2CheckInTime?.toDate().toISOString() || null, s2CheckOutTime: att.s2CheckOutTime?.toDate().toISOString() || null, status: 'Hadir', description: cleanDesc(att.reasonForUpdate), points: pts };
            }
            if (leave) {
                const pts = calculatePoints(leave.type, leave.reason || leave.type, false, false, false, false, isSesi2Active);
                return { id: leave.id, date: dStr, status: leave.type, description: leave.reason || leave.type, points: pts };
            }
            return { id: dStr, date: dStr, status: 'Alpa', description: 'Tanpa Keterangan', points: 0 };
        }).filter(Boolean).sort((a:any, b:any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
