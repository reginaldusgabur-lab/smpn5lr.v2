
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

    if (d.includes('admin') || d.includes('koreksi') || d.includes('lengkapi') || d.includes('diubah oleh admin')) {
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
        const schoolConfigRef = doc(firestore, 'schoolConfig', 'default');
        const monthlyConfigId = format(today, 'yyyy-MM');
        const monthlyConfigRef = doc(firestore, 'monthlyConfigs', monthlyConfigId);

        const [schoolConfigSnap, monthlyConfigSnap] = await Promise.all([
            getDoc(schoolConfigRef),
            getDoc(monthlyConfigRef)
        ]);

        const schoolConfig = schoolConfigSnap.exists() ? schoolConfigSnap.data() : {};
        const monthlyConfig = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};

        const isManualOff = schoolConfig.isAttendanceActive === false;
        const holidays = Array.isArray(monthlyConfig.holidays) ? monthlyConfig.holidays : [];
        const isCalendarHoliday = holidays.includes(todayStr);
        const dayOfWeek = today.getDay();
        const offDays: number[] = Array.isArray(schoolConfig.offDays) ? schoolConfig.offDays : [0, 6];
        const isRecurringOff = offDays.includes(dayOfWeek);

        const isHoliday = !isManualOff && (isCalendarHoliday || isRecurringOff);

        const usersSnap = await getDocs(collection(firestore, 'users'));
        const allStaff = usersSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(u => ['guru', 'pegawai', 'kepala_sekolah'].includes(u.role));

        if (isManualOff || isHoliday) {
            return { 
                totalStaff: allStaff.length, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, 
                isHoliday: isHoliday, 
                isCalendarHoliday: isCalendarHoliday,
                isManualDisabled: isManualOff 
            };
        }

        const attendanceQuery = query(
            collectionGroup(firestore, 'attendanceRecords'),
            where('date', '==', todayStr)
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        const presentUserIds = new Set<string>();
        
        const staffIdsSet = new Set(allStaff.map(s => s.id));
        
        attendanceSnap.forEach(doc => {
            const data = doc.data();
            const userId = data.userId || doc.ref.parent.parent?.id;
            if (userId && staffIdsSet.has(userId)) presentUserIds.add(userId);
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
                    else if (!['Pulang Cepat', 'Dinas Siang', 'Izin Pulang Cepat'].includes(leave.type)) izinCount++;
                } else if (leave.status === 'pending' && !['Pulang Cepat', 'Dinas Siang', 'Izin Pelang Cepat'].includes(leave.type)) {
                    pendingCount++;
                }
            } else {
                alpaCount++;
            }
        });

        return {
            totalStaff: allStaff.length,
            hadir: presentUserIds.size,
            izin: izinCount,
            sakit: sakitCount,
            pending: pendingCount,
            alpa: alpaCount,
            isHoliday: false,
            isManualDisabled: false,
            isCalendarHoliday: isCalendarHoliday
        };
    } catch (e) {
        console.error("Daily stats calculation error:", e);
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false, isManualDisabled: false, isCalendarHoliday: false };
    }
}

export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v302_${userId}_${format(start, 'yyyyMM')}`;
    
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

        const schoolConfig = schoolConfigSnap.exists() ? schoolConfigSnap.data() : {};
        const monthlyConfig = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};
        
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

        const offDays: number[] = Array.isArray(schoolConfig.offDays) ? schoolConfig.offDays : [0, 6];
        const holidays: string[] = Array.isArray(monthlyConfig.holidays) ? monthlyConfig.holidays : [];

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
                const hasIn = !!att.checkInTime;
                const hasOut = !!att.checkOutTime;
                const cleanD = cleanDesc(att.reasonForUpdate);
                
                const p = calculatePoints('hadir', cleanD, hasIn, hasOut);
                totalPoints += p;
                hadirCount++;
                processedDates.add(attDateStr);
            }
        });

        leaveData.forEach(leave => {
            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dayStr) && !processedDates.has(dayStr)) {
                    const p = calculatePoints(leave.type, leave.reason || leave.type, false, false);
                    totalPoints += p;
                    if (leave.type === 'Sakit') sakitCount++;
                    else if (p < 1.0) izinCount++;
                    else hadirCount++;
                    
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
            totalPoints: totalPoints.toFixed(2),
            persentase: Math.min(finalPercentage, 100).toFixed(1) + '%',
        };

        setInCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error("Stats calculation error:", e);
        return { totalHadir: 0, totalIzin: 0, totalSakit: 0, totalAlpa: 0, persentase: '0.0%' };
    }
}

export async function fetchUserMonthlyReportData(firestore: Firestore, userId: string, currentMonth: Date, schoolConfig: any) {
    if (!schoolConfig) return [];
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
        const offDays: number[] = Array.isArray(schoolConfig?.offDays) ? schoolConfig.offDays : [0, 6];
        const holidays: string[] = Array.isArray(monthlyConfig.holidays) ? monthlyConfig.holidays : [];

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
            if (isBefore(todayStart, day) && !isToday) return null;

            const attendanceRecord = attendanceMap.get(dayStr);
            const leaveRecord = leaveMap.get(dayStr);

            if (attendanceRecord) {
                const checkInTime = attendanceRecord.checkInTime?.toDate() || null;
                const checkOutTime = attendanceRecord.checkOutTime?.toDate() || null;
                const isManual = attendanceRecord.manualEntry || false;
                
                let description = cleanDesc(attendanceRecord.reasonForUpdate || 'Kehadiran penuh');
                
                if (checkInTime && checkOutTime && !['dinas pagi', 'dinas siang', 'pulang cepat', 'sakit', 'izin pribadi', 'kegiatan luar sekolah', 'terlambat'].includes(description.toLowerCase())) {
                    if (schoolConfig.useTimeValidation && schoolConfig.checkInEndTime) {
                        const inEndStr = schoolConfig.checkInEndTime;
                        const [h, m] = inEndStr.split(':').map(Number);
                        const deadline = setMinutes(setHours(startOfDay(checkInTime), h), m);
                        if (checkInTime > deadline) description = 'Terlambat';
                    }
                }

                if (!checkOutTime) {
                    description = 'Belum absen pulang';
                }
                if (!checkInTime && checkOutTime) {
                    description = 'Belum absen masuk';
                }
                
                const pts = calculatePoints('hadir', description, !!checkInTime, !!checkOutTime);
                
                return { 
                    id: attendanceRecord.id, 
                    date: day, 
                    checkInTime: checkInTime ? checkInTime.toISOString() : null, 
                    checkOutTime: checkOutTime ? checkOutTime.toISOString() : null, 
                    status: 'Hadir', 
                    description: description.charAt(0).toUpperCase() + description.slice(1), 
                    manualEntry: isManual,
                    points: pts
                };
            }

            if (leaveRecord) {
                const type = leaveRecord.type;
                const isHadirFull = ['Dinas', 'Dinas Pagi', 'Dinas Siang', 'Terlambat', 'Pulang Cepat', 'Izin Pulang Cepat', 'Kegiatan Luar Sekolah'].includes(type);
                const pts = calculatePoints(type, leaveRecord.reason || type, false, false);
                
                return { 
                    id: `${leaveRecord.id}-${dayStr}`, 
                    date: day, checkInTime: null, checkOutTime: null, 
                    status: isHadirFull ? 'Hadir' : type, 
                    description: cleanDesc(leaveRecord.reason) || type,
                    points: pts
                };
            }

            return { id: dayStr, date: day, checkInTime: null, checkOutTime: null, status: 'Alpa', description: 'Tidak ada keterangan', points: 0.0 };
        });

        return report.filter(Boolean).sort((a: any, b: any) => b.date.getTime() - a.date.getTime()).map((item: any) => ({
            ...item,
            date: item.date.toISOString(),
        }));
    } catch (e) {
        console.error("Fetch report error:", e);
        return [];
    }
}
