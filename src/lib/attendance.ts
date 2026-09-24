
'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup, Timestamp } from 'firebase/firestore';
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

    // Poin 1.0 untuk Hadir Penuh, Dinas, atau Kegiatan Luar Sekolah
    if (d.includes('dinas') || d.includes('luar sekolah') || d === 'kehadiran penuh') return 1.0;
    if (hasIn && hasOut && s === 'hadir' && d !== 'terlambat' && !d.includes('cepat')) return 1.0;
    
    // Poin 0.95 untuk Terlambat atau Pulang Cepat
    if (d === 'terlambat' || d.includes('cepat')) return 0.95;
    
    // Poin untuk Sakit/Izin (Cuti juga masuk sini)
    if (s === 'sakit') return 0.9;
    if (s.includes('izin')) return 0.7;
    
    // Poin 0.5 jika hanya absen salah satu (lupa)
    if ((hasIn && !hasOut) || (!hasIn && hasOut)) return 0.5;
    
    return 0.0;
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
            .filter(u => ['guru', 'pegawai', 'kepala_sekolah'].includes(u.role) && u.status !== 'Nonaktif');

        if (isHoliday) return { totalStaff: allStaff.length, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: true };

        const attSnap = await getDocs(query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr)));
        const presentIds = new Set(attSnap.docs.map(d => d.data().userId || d.ref.parent.parent?.id));

        const leaveSnap = await getDocs(query(collectionGroup(firestore, 'leaveRequests'), where('status', '==', 'approved')));
        const leaveMap = new Map();
        leaveSnap.docs.forEach(d => {
            const l = d.data();
            if (isWithinInterval(today, { start: startOfDay(l.startDate.toDate()), end: endOfDay(l.endDate.toDate()) })) {
                leaveMap.set(l.userId || d.ref.parent.parent?.id, l);
            }
        });

        let hadirCount = presentIds.size;
        let izinCount = 0;
        let sakitCount = 0;
        let alpaCount = 0;

        allStaff.forEach(u => {
            if (presentIds.has(u.id)) return;
            const leave = leaveMap.get(u.id);
            if (leave) {
                if (leave.type === 'Sakit') sakitCount++;
                else izinCount++;
            } else {
                alpaCount++;
            }
        });

        return { totalStaff: allStaff.length, hadir: hadirCount, izin: izinCount, sakit: sakitCount, pending: 0, alpa: alpaCount, isHoliday: false };
    } catch (e) { return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false }; }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v311_cuti_${userId}_${format(start, 'yyyyMM')}`;
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
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const workingDays = eachDayOfInterval({ start, end }).filter(day => 
            !(schoolConfig.offDays || [0, 6]).includes(day.getDay()) && 
            !(monthlyConfig.holidays || []).includes(format(day, 'yyyy-MM-dd'))
        );
        const workingDaysSet = new Set(workingDays.map(d => format(d, 'yyyy-MM-dd')));

        let totalPoints = 0;
        let hadirCount = 0;
        let izinCount = 0;
        let sakitCount = 0;
        const processedDates = new Set<string>();

        attendanceSnap.docs.forEach(d => {
            const att = d.data();
            const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr && workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                const pts = calculatePoints('hadir', cleanDesc(att.reasonForUpdate), !!att.checkInTime, !!att.checkOutTime);
                totalPoints += pts; hadirCount++; processedDates.add(dStr);
            }
        });

        leaveSnap.docs.forEach(d => {
            const leave = d.data();
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                    const pts = calculatePoints(leave.type, leave.reason || leave.type, false, false);
                    totalPoints += pts;
                    if (leave.type === 'Sakit') sakitCount++;
                    else izinCount++; // Cuti & Izin Pribadi masuk sini
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
                const pts = calculatePoints('hadir', desc, !!att.checkInTime, !!att.checkOutTime);
                return { id: att.id, date: dStr, checkInTime: att.checkInTime?.toDate().toISOString() || null, checkOutTime: att.checkOutTime?.toDate().toISOString() || null, status: 'Hadir', description: desc, points: pts, manualEntry: att.manualEntry || false };
            }
            if (leave) {
                const pts = calculatePoints(leave.type, leave.reason || leave.type, false, false);
                return { id: `${leave.id}-${dStr}`, date: dStr, status: leave.type, description: leave.reason || leave.type, points: pts, manualEntry: false };
            }
            return { id: dStr, date: dStr, status: 'Alpa', description: 'Tanpa keterangan', points: 0.0, manualEntry: false };
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
