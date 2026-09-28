
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

/**
 * Membersihkan deskripsi agar tampil rapi di laporan.
 */
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
 * Menghitung nilai poin berdasarkan status untuk kalkulasi persentase.
 * Poin 1.0 = Tidak mengurangi persentase.
 * Poin 0.0 = Alpa.
 */
const calculatePoints = (status: string, description: string, hasIn: boolean, hasOut: boolean): number => {
    const s = status.toLowerCase();
    const d = description.toLowerCase();
    
    // Cuti dihitung sebagai hari libur (Poin 1.0 agar tidak merusak rata-rata)
    if (s === 'cuti' || d.includes('cuti')) return 1.0;
    
    // Tugas Kedinasan / Kegiatan Luar Sekolah (Poin Penuh)
    if (d.includes('dinas') || d.includes('luar sekolah') || d === 'kehadiran penuh' || s.includes('luar sekolah')) return 1.0;
    
    // Hadir Normal
    if (hasIn && hasOut && s === 'hadir' && d !== 'terlambat' && !d.includes('cepat')) return 1.0;
    
    // Telat / Pulang Cepat
    if (d === 'terlambat' || d.includes('cepat')) return 0.95;
    
    // Sakit / Izin
    if (s === 'sakit') return 0.9;
    if (s.includes('izin')) return 0.7;
    
    // Absen Setengah
    if ((hasIn && !hasOut) || (!hasIn && hasOut)) return 0.5;
    
    return 0.0;
};

/**
 * Agregasi Statistik Harian untuk Dashboard.
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

        const qPresent = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '==', todayStr));
        const countPresent = await getCountFromServer(qPresent);
        const hadirCount = countPresent.data().count;

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
            else if (!['Pulang Cepat', 'Dinas Siang', 'Cuti', 'Cuti Resmi', 'Kegiatan Luar Sekolah'].includes(l.type)) izinCount++;
        });

        const qPending = query(collectionGroup(firestore, 'leaveRequests'), where('status', '==', 'pending'));
        const countPending = await getCountFromServer(qPending);

        const alpaCount = Math.max(0, totalStaff - (hadirCount + izinCount + sakitCount));

        return { 
            totalStaff, hadir: hadirCount, izin: izinCount, sakit: sakitCount, 
            pending: countPending.data().count, alpa: alpaCount, isHoliday: false 
        };
    } catch (e) {
        return { totalStaff: 0, hadir: 0, izin: 0, sakit: 0, pending: 0, alpa: 0, isHoliday: false };
    }
}

/**
 * Kalkulasi Statistik Kehadiran Bulanan per User.
 */
export async function calculateAttendanceStats(firestore: Firestore, userId: string, dateRange: { start: Date, end: Date }) {
    const { start, end } = dateRange;
    const cacheKey = `stats_v600_${userId}_${format(start, 'yyyyMM')}`;
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
        const cutiDates = new Set<string>();

        // Identifikasi tanggal CUTI terlebih dahulu (untuk mengurangi pembagi hari kerja)
        leaveSnap.docs.forEach(d => {
            const leave = d.data();
            if (leave.type === 'Cuti' || leave.type === 'Cuti Resmi') {
                eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                    cutiDates.add(format(day, 'yyyy-MM-dd'));
                });
            }
        });

        // Filter hari kerja: Hapus hari di mana user sedang CUTI
        const userSpecificWorkingDays = baseWorkingDays.filter(day => !cutiDates.has(format(day, 'yyyy-MM-dd')));
        const workingDaysSet = new Set(userSpecificWorkingDays.map(d => format(d, 'yyyy-MM-dd')));

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
            if (leave.type === 'Cuti' || leave.type === 'Cuti Resmi') return; // Sudah ditangani di atas

            eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                    totalPoints += calculatePoints(leave.type, leave.reason || leave.type, false, false);
                    if (leave.type === 'Sakit') sakitCount++; else izinCount++;
                    processedDates.add(dayStr);
                }
            });
        });

        const pastWorkingDays = userSpecificWorkingDays.filter(day => format(day, 'yyyy-MM-dd') <= todayStr);
        const alpaCount = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;
        
        const denominator = Math.max(1, userSpecificWorkingDays.length);
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

/**
 * Mengambil data riwayat bulanan lengkap untuk tabel laporan.
 */
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
                return { 
                    id: att.id, date: dStr, 
                    checkInTime: att.checkInTime?.toDate().toISOString() || null, 
                    checkOutTime: att.checkOutTime?.toDate().toISOString() || null, 
                    status: 'Hadir', description: desc, 
                    points: calculatePoints('hadir', desc, !!att.checkInTime, !!att.checkOutTime), 
                    manualEntry: att.manualEntry || false 
                };
            }
            if (leave) {
                const type = (leave.type === 'Cuti' || leave.type === 'Cuti Resmi') ? 'Cuti' : leave.type;
                const pts = calculatePoints(type, leave.reason || type, false, false);
                // Jika poin 1.0, status ditampilkan sebagai 'Hadir' (untuk dinas/luar sekolah)
                const statusLabel = (type === 'Cuti') ? 'Cuti' : (pts === 1.0 ? 'Hadir' : type);
                
                return { 
                    id: `${leave.id}-${dStr}`, date: dStr, 
                    status: statusLabel, 
                    description: cleanDesc(leave.reason) || type, 
                    points: pts, manualEntry: false 
                };
            }
            return { id: dStr, date: dStr, status: 'Alpa', description: 'Tanpa keterangan', points: 0.0, manualEntry: false };
        }).filter(Boolean).sort((a: any, b: any) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
}
