'use client';

import { doc, getDoc, collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { format, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, isBefore, isSameDay, setHours, setMinutes, isValid } from 'date-fns';
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

/**
 * Parsing aman untuk data tanggal dari Firestore (Timestamp atau ISO String).
 */
const parseFirestoreDate = (input: any): Date | null => {
    if (!input) return null;
    if (typeof input.toDate === 'function') return input.toDate();
    const date = new Date(input);
    return isValid(date) ? date : null;
};

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

/**
 * Logika Poin Profesional.
 */
export const calculatePoints = (status: string, description: string, hasIn: boolean, hasOut: boolean, isToday: boolean = false): number => {
    const s = status.toLowerCase();
    const d = description.toLowerCase();
    
    if (s === 'cuti' || d.includes('cuti') || s.includes('cuti')) return 1.0;
    if (d.includes('dinas') || d.includes('luar sekolah') || d === 'kehadiran penuh' || s.includes('luar sekolah')) return 1.0;
    
    if (hasIn && hasOut && s === 'hadir' && d !== 'terlambat' && !d.includes('cepat')) return 1.0;
    if (d === 'terlambat' || d.includes('cepat')) return 0.95;
    if (s === 'sakit') return 0.9;
    if (s.includes('izin')) return 0.7;
    
    if (hasIn || hasOut) {
        return isToday ? 1.0 : 0.5;
    }
    
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
        
        const holidays = Array.isArray(mConfig.holidays) ? mConfig.holidays : [];
        const offDays = Array.isArray(config.offDays) ? config.offDays : [0, 6];
        
        const isHoliday = isManualOff || holidays.includes(todayStr) || offDays.includes(today.getDay());

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
        
        const presentMap = new Map();
        attSnap.forEach(d => {
            const data = d.data();
            const uid = data.userId || d.ref.parent.parent?.id;
            if (uid) {
                const existing = presentMap.get(uid);
                if (!existing || (!existing.checkOutTime && data.checkOutTime)) {
                    presentMap.set(uid, data);
                }
            }
        });

        const qLeave = query(collectionGroup(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'pending']));
        const leaveSnap = await getDocs(qLeave);
        const leavesToday = leaveSnap.docs.filter(d => {
            const l = d.data();
            const start = parseFirestoreDate(l.startDate);
            const end = parseFirestoreDate(l.endDate);
            return start && end && isWithinInterval(today, { start: startOfDay(start), end: endOfDay(end) });
        });

        let hadirCount = 0; let izinCount = 0; let sakitCount = 0; let cutiCount = 0; let pendingCount = 0; let alpaCount = 0;

        allStaff.forEach((u: any) => {
            const attData = presentMap.get(u.id);
            if (attData) {
                const desc = (attData.reasonForUpdate || '').toLowerCase();
                if (desc.includes('luar sekolah')) izinCount++;
                else hadirCount++;
                return;
            }

            const userLeaveDoc = leavesToday.find(d => (d.data().userId || d.ref.parent.parent?.id) === u.id);
            if (userLeaveDoc) {
                const l = userLeaveDoc.data();
                if (l.status === 'approved') {
                    const type = (l.type || '').toLowerCase();
                    const reason = (l.reason || '').toLowerCase();
                    if (type.includes('sakit')) sakitCount++;
                    else if (type.includes('cuti')) cutiCount++;
                    else if (type.includes('luar sekolah') || reason.includes('luar sekolah')) izinCount++;
                    else if (type.includes('dinas')) hadirCount++;
                    else izinCount++;
                } else {
                    pendingCount++;
                }
            } else if (u.status === 'Cuti') {
                // Jika status akun Cuti tapi tidak ada dokumen izin aktif hari ini -> Hitung Alpa (Cuti Berakhir)
                alpaCount++;
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
            isCalendarHoliday: holidays.includes(todayStr)
        };
    } catch (e) {
        console.error("Daily stats calculation error:", e);
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, cuti: 0, pending: 0, alpa: 0, isHoliday: false };
    }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const cacheKey = `stats_v960_${userId}_${format(start, 'yyyyMM')}_${todayStr}`;
    const cached = getFromCache(cacheKey); if (cached) return cached;
    
    try {
        const [configSnap, monthlyConfigSnap, attendanceSnap, leaveSnap, userSnap] = await Promise.all([
            getDoc(doc(firestore, 'schoolConfig', 'default')),
            getDoc(doc(firestore, 'monthlyConfigs', format(start, 'yyyy-MM'))),
            getDocs(collection(firestore, 'users', userId, 'attendanceRecords')),
            getDocs(query(collection(firestore, 'users', userId, 'leaveRequests'), where('status', '==', 'approved'))),
            getDoc(doc(firestore, 'users', userId))
        ]);
        
        const config = configSnap.data() || {};
        const mConfig = monthlyConfigSnap.data() || {};
        const userData = userSnap.data();
        
        const holidays = Array.isArray(mConfig.holidays) ? mConfig.holidays : [];
        const offDays = Array.isArray(config.offDays) ? config.offDays : [0, 6];

        const allWorkingDays = eachDayOfInterval({ start, end }).filter(day => 
            !offDays.includes(day.getDay()) && !holidays.includes(format(day, 'yyyy-MM-dd'))
        );

        let totalPoints = 0;
        let hadirCount = 0; let izinCount = 0; let sakitCount = 0;
        const processedDates = new Set<string>();
        
        const attMap = new Map();
        attendanceSnap.docs.forEach(d => {
            const data = d.data();
            const dStr = data.date || (data.checkInTime ? format(parseFirestoreDate(data.checkInTime)!, 'yyyy-MM-dd') : '');
            if (dStr) attMap.set(dStr, data);
        });

        allWorkingDays.forEach((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            if (dayStr > todayStr) return;

            const isToday = dayStr === todayStr;
            const att = attMap.get(dayStr);
            const leaveDoc = leaveSnap.docs.find(ld => {
                const l = ld.data();
                const lS = parseFirestoreDate(l.startDate);
                const lE = parseFirestoreDate(l.endDate);
                return lS && lE && isWithinInterval(day, { start: startOfDay(lS), end: endOfDay(lE) });
            });

            if (leaveDoc) {
                const leave = leaveDoc.data();
                const p = calculatePoints(leave.type, leave.reason || leave.type, false, false, false);
                totalPoints += p;
                processedDates.add(dayStr);
                
                const typeLower = (leave.type || '').toLowerCase();
                const reasonLower = (leave.reason || '').toLowerCase();
                if (typeLower.includes('sakit')) sakitCount++;
                else if (typeLower.includes('cuti')) izinCount++;
                else if (typeLower.includes('luar sekolah') || reasonLower.includes('luar sekolah')) izinCount++;
                else if (typeLower.includes('dinas')) hadirCount++;
                else if (p < 1.0) izinCount++;
                else hadirCount++;
            } else if (att) {
                const desc = cleanDesc(att.reasonForUpdate).toLowerCase();
                const checkInDate = parseFirestoreDate(att.checkInTime);
                const checkOutDate = parseFirestoreDate(att.checkOutTime);
                totalPoints += calculatePoints('hadir', desc, !!checkInDate, !!checkOutDate, isToday);
                processedDates.add(dayStr);
                
                if (desc.includes('luar sekolah')) izinCount++;
                else hadirCount++;
            }
        });

        const denominator = Math.max(1, allWorkingDays.length);
        const pastWorkingDays = allWorkingDays.filter(day => format(day, 'yyyy-MM-dd') <= todayStr);
        const alpaCount = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;

        const hasActiveCutiToday = leaveSnap.docs.some(ld => {
            const l = ld.data();
            const lS = parseFirestoreDate(l.startDate);
            const lE = parseFirestoreDate(l.endDate);
            return (l.type || '').toLowerCase().includes('cuti') && lS && lE && isWithinInterval(today, { start: startOfDay(lS), end: endOfDay(lE) });
        });

        const isCurrentlyCuti = userData?.status === 'Cuti' && hasActiveCutiToday;

        const result = {
            totalPoints: isCurrentlyCuti ? "-" : totalPoints.toFixed(2),
            persentase: isCurrentlyCuti ? "-" : (Math.min((totalPoints / denominator) * 100, 100).toFixed(1) + '%'),
            pastWorkingDaysCount: pastWorkingDays.length,
            totalWorkingDaysCount: allWorkingDays.length,
            totalHadir: hadirCount,
            totalIzin: izinCount,
            totalSakit: sakitCount,
            totalAlpa: alpaCount
        };
        setInCache(cacheKey, result); return result;
    } catch (e) {
        return { totalPoints: "0.00", persentase: '0.0%', pastWorkingDaysCount: 0, totalWorkingDaysCount: 1, totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0 };
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
        const holidays = Array.isArray(mConfig.holidays) ? mConfig.holidays : [];
        const offDays = Array.isArray(schoolConfig.offDays) ? schoolConfig.offDays : [0, 6];

        const attMap = new Map();
        attSnap.docs.forEach(d => {
            const data = d.data();
            const dStr = data.date || (data.checkInTime ? format(parseFirestoreDate(data.checkInTime)!, 'yyyy-MM-dd') : '');
            if (dStr) attMap.set(dStr, { id: d.id, ...data });
        });

        const leaveMap = new Map();
        leaveSnap.docs.forEach(d => {
            const l = d.data();
            const lS = parseFirestoreDate(l.startDate);
            const lE = parseFirestoreDate(l.endDate);
            if (lS && lE) eachDayOfInterval({ start: lS, end: lE }).forEach(day => leaveMap.set(format(day, 'yyyy-MM-dd'), { ...l, id: d.id }));
        });

        const workingDays = eachDayOfInterval({ start, end }).filter(d => !offDays.includes(d.getDay()) && !holidays.includes(format(d, 'yyyy-MM-dd')));
        
        return workingDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isToday = dayStr === todayStr;
            const att = attMap.get(dayStr); 
            const leave = leaveMap.get(dayStr);

            if (att) {
                let desc = cleanDesc(att.reasonForUpdate);
                const checkInDate = parseFirestoreDate(att.checkInTime);
                const checkOutDate = parseFirestoreDate(att.checkOutTime);
                if (checkInDate && schoolConfig.useTimeValidation && schoolConfig.checkInEndTime && !desc.toLowerCase().includes('dinas')) {
                    const [h, m] = schoolConfig.checkInEndTime.split(':').map(Number);
                    const deadline = setMinutes(setHours(startOfDay(checkInDate), h), m);
                    if (checkInDate > deadline) desc = 'Terlambat';
                }
                const lowerDesc = desc.toLowerCase();
                if (!lowerDesc.includes('dinas') && !lowerDesc.includes('luar sekolah') && !lowerDesc.includes('cuti')) {
                    if (checkInDate && !checkOutDate && !lowerDesc.includes('cepat')) desc = 'Belum absen pulang';
                    else if (!checkInDate && checkOutDate && !lowerDesc.includes('terlambat')) desc = 'Belum absen masuk';
                }
                return { 
                    id: att.id, date: dayStr, checkInTime: checkInDate?.toISOString() || null, checkOutTime: checkOutDate?.toISOString() || null, 
                    status: lowerDesc.includes('luar sekolah') ? 'Izin' : 'Hadir', description: desc, 
                    points: calculatePoints('hadir', desc, !!checkInDate, !!checkOutDate, isToday), manualEntry: att.manualEntry || false 
                };
            }
            if (leave) {
                const type = (leave.type === 'Cuti' || leave.type === 'Cuti Resmi') ? 'Cuti' : leave.type;
                const pts = calculatePoints(type, leave.reason || type, false, false, false);
                const lowerT = type.toLowerCase();
                let statusLabel = (type === 'Cuti') ? 'Cuti' : (pts === 1.0 ? 'Hadir' : type);
                if (lowerT.includes('luar sekolah')) statusLabel = 'Izin';
                return { id: `${leave.id}-${dayStr}`, date: dayStr, status: statusLabel, description: cleanDesc(leave.reason) || type, points: pts, manualEntry: false };
            }
            
            if (dayStr <= todayStr) {
                return { id: dayStr, date: dayStr, status: 'Alpa', description: 'Tanpa keterangan', points: 0.0, manualEntry: false };
            }

            return null;
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
