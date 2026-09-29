'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { format, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
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
    if (d === 'cuti' || d === 'cuti resmi') return 'Cuti resmi';
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
    if (s === 'cuti' || d.includes('cuti') || s.includes('cuti')) return 1.0;
    if (d.includes('dinas') || d.includes('luar sekolah') || d === 'kehadiran penuh' || s.includes('luar sekolah')) return 1.0;
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
        const [configSnap, monthlySnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(today, 'yyyy-MM')))
        ]);
        const config = configSnap.data() || {};
        const mConfig = monthlySnap.data() || {};
        const isManualOff = config.isAttendanceActive === false;
        const isHoliday = isManualOff || (mConfig.holidays || []).includes(todayStr) || (config.offDays || [0, 6]).includes(today.getDay());

        const qUsers = query(
            collection(firestore, 'users'), 
            where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']),
            where('status', 'in', ['Aktif', 'Cuti'])
        );
        const usersSnap = await getDocs(qUsers);
        const allStaff = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        if (isHoliday) {
            return { totalStaff: allStaff.length, hadir: 0, izin: 0, sakit: 0, cuti: 0, pending: 0, alpa: 0, isHoliday: true, isManualDisabled: isManualOff };
        }

        const qPresent = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr));
        const attSnap = await getDocs(qPresent);
        const presentIds = new Set();
        attSnap.forEach(d => {
            const uid = d.data().userId || d.ref.parent.parent?.id;
            if (uid) presentIds.add(uid);
        });

        const qLeave = query(collectionGroup(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'pending']));
        const leaveSnap = await getDocs(qLeave);
        const leavesToday = leaveSnap.docs.filter(d => {
            const l = d.data();
            const start = l.startDate?.toDate();
            const end = l.endDate?.toDate();
            return start && end && isWithinInterval(today, { start: startOfDay(start), end: endOfDay(end) });
        });

        let hadirCount = 0; let izinCount = 0; let sakitCount = 0; let cutiCount = 0; let pendingCount = 0; let alpaCount = 0;

        allStaff.forEach((u: any) => {
            if (presentIds.has(u.id)) {
                hadirCount++;
                return;
            }
            if (u.status === 'Cuti') {
                cutiCount++;
                return;
            }
            const userLeaveDoc = leavesToday.find(d => (d.data().userId || d.ref.parent.parent?.id) === u.id);
            if (userLeaveDoc) {
                const l = userLeaveDoc.data();
                if (l.status === 'approved') {
                    const type = (l.type || '').toLowerCase();
                    if (type.includes('sakit')) sakitCount++;
                    else if (type.includes('cuti')) cutiCount++;
                    else izinCount++;
                } else {
                    pendingCount++;
                }
            } else {
                alpaCount++;
            }
        });

        return {
            totalStaff: allStaff.length,
            hadir: hadirCount,
            izin: izinCount,
            sakit: sakitCount,
            cuti: cutiCount,
            pending: pendingCount,
            alpa: alpaCount,
            isHoliday: false,
            isManualDisabled: isManualOff,
            isCalendarHoliday: (mConfig.holidays || []).includes(todayStr)
        };
    } catch (e) {
        console.error("Daily stats calculation error:", e);
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, cuti: 0, pending: 0, alpa: 0, isHoliday: false };
    }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v902_${userId}_${format(start, 'yyyyMM')}`;
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
        const baseWorkingDays = eachDayOfInterval({ start, end }).filter(day => 
            !(schoolConfig.offDays || [0, 6]).includes(day.getDay()) && 
            !(monthlyConfig.holidays || []).includes(format(day, 'yyyy-MM-dd'))
        );
        let totalPoints = 0; let hadirCount = 0; let izinCount = 0; let sakitCount = 0;
        const processedDates = new Set<string>();
        attendanceSnap.docs.forEach(d => {
            const att = d.data();
            const dayStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dayStr && !processedDates.has(dayStr)) {
                if (baseWorkingDays.some(bw => format(bw, 'yyyy-MM-dd') === dayStr)) {
                    totalPoints += calculatePoints('hadir', cleanDesc(att.reasonForUpdate), !!att.checkInTime, !!att.checkOutTime);
                    hadirCount++; processedDates.add(dayStr);
                }
            }
        });
        leaveSnap.docs.forEach(leaveDoc => {
            const leave = leaveDoc.data();
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                if (baseWorkingDays.some(bw => format(bw, 'yyyy-MM-dd') === dayStr) && !processedDates.has(dayStr)) {
                    const p = calculatePoints(leave.type, leave.reason || leave.type, false, false);
                    totalPoints += p;
                    if (leave.type === 'Sakit') sakitCount++; 
                    else if (leave.type === 'Cuti' || leave.type === 'Cuti Resmi') hadirCount++;
                    else if (p < 1.0) izinCount++;
                    else hadirCount++;
                    processedDates.add(dayStr);
                }
            });
        });
        const pastWorkingDays = baseWorkingDays.filter(day => format(day, 'yyyy-MM-dd') <= todayStr);
        const alpaCount = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;
        const denominator = Math.max(1, baseWorkingDays.length);
        const finalPercentage = (totalPoints / denominator) * 100;
        const result = {
            totalHadir: hadirCount, totalIzin: izinCount, totalSakit: sakitCount, totalAlpa: alpaCount,
            totalPoints: totalPoints.toFixed(2),
            persentase: Math.min(finalPercentage, 100).toFixed(1) + '%'
        };
        setInCache(cacheKey, result); return result;
    } catch (e) {
        console.error("Stats Error:", e);
        return { totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, persentase: '0.0%' };
    }
}

export async function fetchUserMonthlyReportData(firestore: Firestore, userId: string, currentMonth: Date, schoolConfig: any) {
    if (!schoolConfig) return [];
    const start = startOfMonth(currentMonth); const end = endOfMonth(currentMonth);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
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
            const dayStr = data.date || (data.checkInTime ? format(data.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dayStr) attMap.set(dayStr, { id: d.id, ...data });
        });
        const leaveMap = new Map();
        leaveSnap.docs.forEach(d => {
            const l = d.data();
            eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).forEach(day => leaveMap.set(format(day, 'yyyy-MM-dd'), { ...l, id: d.id }));
        });
        const workingDays = eachDayOfInterval({ start, end }).filter(d => !(schoolConfig.offDays || [0, 6]).includes(d.getDay()) && !mConfig.holidays?.includes(format(d, 'yyyy-MM-dd')));
        return workingDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            if (dayStr > todayStr) return null;
            const att = attMap.get(dayStr); const leave = leaveMap.get(dayStr);
            if (att) {
                const desc = cleanDesc(att.reasonForUpdate);
                const checkInDate = att.checkInTime?.toDate() || null;
                let finalDesc = desc;
                if (checkInDate && schoolConfig.useTimeValidation && schoolConfig.checkInEndTime && !desc.toLowerCase().includes('dinas')) {
                    const [h, m] = schoolConfig.checkInEndTime.split(':').map(Number);
                    const deadline = setMinutes(setHours(startOfDay(checkInDate), h), m);
                    if (checkInDate > deadline) finalDesc = 'Terlambat';
                }
                return { 
                    id: att.id, date: dayStr, 
                    checkInTime: att.checkInTime?.toDate().toISOString() || null, 
                    checkOutTime: att.checkOutTime?.toDate().toISOString() || null, 
                    status: 'Hadir', description: finalDesc, 
                    points: calculatePoints('hadir', finalDesc, !!att.checkInTime, !!att.checkOutTime), 
                    manualEntry: att.manualEntry || false 
                };
            }
            if (leave) {
                const type = (leave.type === 'Cuti' || leave.type === 'Cuti Resmi') ? 'Cuti' : leave.type;
                const pts = calculatePoints(type, leave.reason || type, false, false);
                const statusLabel = (type === 'Cuti') ? 'Cuti' : (pts === 1.0 ? 'Hadir' : type);
                return { 
                    id: `${leave.id}-${dayStr}`, date: dayStr, status: statusLabel, 
                    description: cleanDesc(leave.reason) || type, points: pts, manualEntry: false 
                };
            }
            return { id: dayStr, date: dayStr, status: 'Alpa', description: 'Tanpa keterangan', points: 0.0, manualEntry: false };
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
