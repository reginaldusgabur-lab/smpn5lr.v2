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

export async function getDailyStaffAttendanceStats(firestore: Firestore) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    try {
        const schoolConfigRef = doc(firestore, 'schoolConfig', 'default');
        const monthlyConfigId = format(today, 'yyyy-MM');
        const monthlyConfigRef = doc(firestore, 'monthlyConfigs', monthlyConfigId);
        const [schoolConfigSnap, monthlyConfigSnap] = await Promise.all([getDoc(schoolConfigRef), getDoc(monthlyConfigRef)]);
        const schoolConfig = schoolConfigSnap.exists() ? schoolConfigSnap.data() : {};
        const monthlyConfig = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};
        const isManualOff = schoolConfig.isAttendanceActive === false;
        const holidays = Array.isArray(monthlyConfig.holidays) ? monthlyConfig.holidays : [];
        const isCalendarHoliday = holidays.includes(todayStr);
        const offDays: number[] = Array.isArray(schoolConfig.offDays) ? schoolConfig.offDays : [0, 6];
        const isHoliday = !isManualOff && (isCalendarHoliday || offDays.includes(today.getDay()));
        if (isManualOff || isHoliday) return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday, isCalendarHoliday, isManualDisabled: isManualOff };

        const usersQuery = query(collection(firestore, 'users'), where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']), where('status', '==', 'Aktif'));
        const usersSnap = await getDocs(usersQuery);
        const allStaff = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const staffIdsSet = new Set(allStaff.map(s => s.id));
        const attendanceQuery = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr));
        const attendanceSnap = await getDocs(attendanceQuery);
        const presentUserIds = new Set<string>();
        attendanceSnap.forEach(doc => {
            const uid = doc.data().userId || doc.ref.parent.parent?.id;
            if (uid && staffIdsSet.has(uid)) presentUserIds.add(uid);
        });

        const leaveQuery = query(collectionGroup(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'pending']));
        const leaveSnap = await getDocs(leaveQuery);
        let izin = 0, sakit = 0, pending = 0, alpa = 0;

        allStaff.forEach((u: any) => {
            if (presentUserIds.has(u.id)) return;
            const activeLeave = leaveSnap.docs.find(d => {
                const l = d.data();
                const uid = l.userId || d.ref.parent.parent?.id;
                return uid === u.id && isWithinInterval(today, { start: startOfDay(l.startDate.toDate()), end: endOfDay(l.endDate.toDate()) });
            });
            if (activeLeave) {
                const l = activeLeave.data();
                if (l.status === 'approved') {
                    if (l.type === 'Sakit') sakit++;
                    else if (!['Pulang Cepat', 'Dinas Siang'].includes(l.type)) izin++;
                } else if (l.status === 'pending' && !['Pulang Cepat', 'Dinas Siang'].includes(l.type)) pending++;
            } else alpa++;
        });
        return { totalStaff: allStaff.length, hadir: presentUserIds.size, izin, sakit, pending, alpa, isHoliday: false, isManualDisabled: false, isCalendarHoliday };
    } catch (e) { return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false, isManualDisabled: false, isCalendarHoliday: false }; }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v172_${userId}_${format(start, 'yyyyMM')}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;
    try {
        const [configSnap, mConfigSnap, attSnap, leaveSnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(start, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);
        const config = configSnap.data() || {};
        const holidays = mConfigSnap.data()?.holidays || [];
        const offDays = config.offDays || [0, 6];
        const workingDays = eachDayOfInterval({ start, end }).filter(day => !offDays.includes(day.getDay()) && !holidays.includes(format(day, 'yyyy-MM-dd')));
        const workingDaysSet = new Set(workingDays.map(d => format(d, 'yyyy-MM-dd')));
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        let points = 0, hadir = 0, izin = 0, sakit = 0, processed = new Set<string>();
        attSnap.docs.forEach(d => {
            const att = d.data();
            const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr && workingDaysSet.has(dStr) && !processed.has(dStr)) {
                const desc = (att.reasonForUpdate || '').toLowerCase();
                let p = 0;
                if (desc.includes('dinas') || desc.includes('luar sekolah') || desc.includes('kehadiran penuh')) p = 1.0;
                else if (desc.includes('terlambat') || desc.includes('pulang cepat')) p = 0.95;
                else if (att.checkInTime && att.checkOutTime) p = 1.0;
                else if (att.checkInTime || att.checkOutTime) p = 0.5;
                points += p; hadir++; processed.add(dStr);
            }
        });
        leaveSnap.docs.forEach(d => {
            const l = d.data();
            eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dStr) && !processed.has(dStr)) {
                    let p = 0;
                    if (l.type === 'Sakit') { p = 0.9; sakit++; }
                    else if (['Izin', 'Izin Pribadi', 'Terlambat'].includes(l.type)) { p = l.type === 'Terlambat' ? 0.95 : 0.7; izin++; }
                    else { p = 1.0; hadir++; }
                    points += p; processed.add(dStr);
                }
            });
        });
        const alpa = workingDays.filter(d => format(d, 'yyyy-MM-dd') <= todayStr && !processed.has(format(d, 'yyyy-MM-dd'))).length;
        const res = { totalHadir: hadir, totalIzin: izin, totalSakit: sakit, totalAlpa: alpa, persentase: Math.min((points / (workingDays.length || 1)) * 100, 100).toFixed(1) + '%' };
        setInCache(cacheKey, res); return res;
    } catch (e) { return { totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, persentase: '0.0%' }; }
}

export async function fetchUserMonthlyReportData(firestore: Firestore, userId: string, currentMonth: Date, schoolConfig: any) {
    if (!schoolConfig) return [];
    try {
        const [mConfigSnap, attSnap, leaveSnap] = await Promise.all([
            getDoc(doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved')))
        ]);
        const mConfig = mConfigSnap.data() || {};
        const start = startOfMonth(currentMonth), end = endOfMonth(currentMonth);
        const attMap = new Map(), leaveMap = new Map();
        attSnap.docs.forEach(d => {
            const rec = d.data();
            const dStr = rec.date || (rec.checkInTime ? format(rec.checkInTime.toDate(), 'yyyy-MM-dd') : '');
            if (dStr >= format(start, 'yyyy-MM-dd') && dStr <= format(end, 'yyyy-MM-dd')) attMap.set(dStr, { ...rec, id: d.id });
        });
        leaveSnap.docs.forEach(d => {
            const l = d.data();
            eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (dStr >= format(start, 'yyyy-MM-dd') && dStr <= format(end, 'yyyy-MM-dd')) leaveMap.set(dStr, { ...l, id: d.id });
            });
        });
        const offDays = schoolConfig.offDays || [0, 6], holidays = mConfig.holidays || [], today = startOfDay(new Date());
        const report = eachDayOfInterval({ start, end }).map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            if (offDays.includes(day.getDay()) || holidays.includes(dStr) || (isBefore(today, day) && !isSameDay(day, today))) return null;
            const att = attMap.get(dStr), leave = leaveMap.get(dStr);
            if (att) {
                const inT = att.checkInTime?.toDate() || null, outT = att.checkOutTime?.toDate() || null;
                let desc = cleanDesc(att.reasonForUpdate || 'Kehadiran penuh');
                if (inT && outT && !['dinas pagi', 'dinas siang', 'pulang cepat', 'sakit', 'izin pribadi', 'kegiatan luar sekolah', 'terlambat'].includes(desc.toLowerCase())) {
                    const [hE, mE] = (schoolConfig.checkInEndTime || '07:30').split(':').map(Number);
                    if (inT > setMinutes(setHours(startOfDay(inT), hE), mE)) desc = 'Terlambat';
                }
                const low = desc.toLowerCase();
                if (['dinas pagi', 'dinas siang', 'pulang cepat', 'terlambat', 'kegiatan luar sekolah'].includes(low)) {
                    return { id: att.id, date: day, checkInTime: low === 'kegiatan luar sekolah' ? null : inT, checkOutTime: low === 'kegiatan luar sekolah' ? null : outT, status: 'Hadir', description: desc, manualEntry: att.manualEntry || false };
                }
                return { id: att.id, date: day, checkInTime: inT, checkOutTime: outT, status: 'Hadir', description: !outT ? 'Belum absen pulang' : desc, manualEntry: att.manualEntry || false };
            }
            if (leave) {
                const isDuty = ['Dinas', 'Dinas Pagi', 'Dinas Siang', 'Terlambat', 'Pulang Cepat', 'Kegiatan Luar Sekolah'].includes(leave.type);
                if (['Pulang Cepat', 'Dinas Siang'].includes(leave.type)) return { id: `${leave.id}-${dStr}`, date: day, checkInTime: null, checkOutTime: null, status: 'Alpa', description: `Tugas ${leave.type} (Tanpa absen masuk)` };
                return { id: `${leave.id}-${dStr}`, date: day, checkInTime: null, checkOutTime: null, status: isDuty ? 'Hadir' : leave.type, description: cleanDesc(leave.reason) || leave.type };
            }
            return { id: dStr, date: day, checkInTime: null, checkOutTime: null, status: 'Alpa', description: 'Tidak ada keterangan' };
        });
        return report.filter(Boolean).sort((a: any, b: any) => b.date.getTime() - a.date.getTime()).map((item: any) => ({ ...item, date: item.date.toISOString(), checkInTime: item.checkInTime?.toISOString() || null, checkOutTime: item.checkOutTime?.toISOString() || null }));
    } catch (e) { return []; }
}