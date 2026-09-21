'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { format, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, isBefore, isSameDay, setHours, setMinutes, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
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

const cleanDesc = (desc: any) => {
    if (!desc || typeof desc !== 'string') return 'Kehadiran penuh';
    const d = desc.toLowerCase();
    if (d.includes('admin') || d.includes('koreksi') || d.includes('lengkapi')) return 'Kehadiran penuh';
    return desc.trim() || 'Kehadiran penuh';
};

export async function getDailyStaffAttendanceStats(firestore: Firestore) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    try {
        const [configSnap, monthlySnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(today, 'yyyy-MM')))
        ]);
        const config = configSnap.data() || {};
        const mConfig = monthlySnap.data() || {};
        const isManualOff = config.isAttendanceActive === false;
        const isHoliday = isManualOff || (mConfig.holidays || []).includes(todayStr) || (config.offDays || [0, 6]).includes(today.getDay());

        const usersSnap = await getDocs(collection(firestore, 'users'));
        const allStaff = usersSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(u => ['guru', 'pegawai', 'kepala_sekolah'].includes(u.role) && u.status === 'Aktif');

        if (isHoliday) return { totalStaff: allStaff.length, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: true };

        const attSnap = await getDocs(query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr)));
        const presentIds = new Set(attSnap.docs.map(d => d.data().userId || d.ref.parent.parent?.id));

        return { totalStaff: allStaff.length, hadir: presentIds.size, izin: 0, sakit: 0, pending: 0, alpa: allStaff.length - presentIds.size, isHoliday: false };
    } catch (e) { return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false }; }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start } = dateRange;
    const cacheKey = `stats_v304_${userId}_${format(start, 'yyyyMM')}`;
    const cached = getFromCache(cacheKey); if (cached) return cached;
    return { persentase: '0.0%', totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, totalPoints: '0.00' };
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
            if (att) return { id: att.id, date: dStr, checkInTime: att.checkInTime?.toDate().toISOString() || null, checkOutTime: att.checkOutTime?.toDate().toISOString() || null, status: 'Hadir', description: cleanDesc(att.reasonForUpdate) };
            if (leave) return { id: leave.id, date: dStr, status: leave.type, description: leave.reason || leave.type };
            return { id: dStr, date: dStr, status: 'Alpa', description: 'Tanpa keterangan' };
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}