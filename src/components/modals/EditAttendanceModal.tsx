
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, writeBatch, Timestamp, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { fetchUserMonthlyReportData } from '@/lib/attendance';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogFooter, 
    DialogTitle, 
    DialogDescription,
    DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { format, parseISO, isValid, startOfDay, endOfDay, addMinutes, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { MoreVertical, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { invalidateCache } from '@/lib/cache';
import { cn } from '@/lib/utils';

export default function EditAttendanceModal({ user, month, isOpen, onClose, currentUser }) {
    const firestore = useFirestore();
    const [problematicDays, setProblematicDays] = useState<any[]>([]);
    const [selectedDays, setSelectedDays] = useState<{ [key: string]: boolean }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [schoolConfig, setSchoolConfig] = useState<any>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        if (!isOpen || !firestore || !user) return;
        const getProblematicDays = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const schoolConfigRef = doc(firestore, 'schoolConfig', 'default');
                const schoolConfigSnap = await getDoc(schoolConfigRef);
                const config = schoolConfigSnap.exists() ? schoolConfigSnap.data() : {};
                if (isMounted.current) setSchoolConfig(config);
                const reportData = await fetchUserMonthlyReportData(firestore, user.uid, month, config);
                
                const problems = reportData.filter(d => 
                    (d.status === 'Alpa') || 
                    (d.description.includes('Belum')) ||
                    (d.description.includes('Tanpa')) ||
                    (d.status === 'Terlambat')
                );
                if (isMounted.current) {
                    setProblematicDays(problems);
                    setSelectedDays({});
                    setIsLoading(false);
                }
            } catch (err) { if (isMounted.current) { setIsLoading(false); setError('Gagal memuat data.'); } }
        };
        getProblematicDays();
        return () => { isMounted.current = false; };
    }, [isOpen, firestore, user, month]);

    const handleSelectDay = (dayId: string) => setSelectedDays(prev => ({ ...prev, [dayId]: !prev[dayId] }));

    const getDailyOutStart = (date: Date, config: any) => {
        if (!config) return '14:00';
        const dayOfWeek = date.getDay().toString();
        const dailyOut = config.dailyCheckOutTimes?.[dayOfWeek];
        return dailyOut?.start || config.checkOutStartTime || '14:00';
    };

    const handleAlpaConversionToLeave = async (day: any, newStatus: 'Sakit' | 'Izin' | 'Dinas') => {
        if (!currentUser?.uid || !firestore || !user) return;
        setIsSaving(true);
        try {
            const targetDate = parseISO(day.date);
            const batch = writeBatch(firestore);
            const todayStr = format(targetDate, 'yyyy-MM-dd');
            
            const attendanceRef = collection(firestore, 'users', user.uid, 'attendanceRecords');
            const qA = query(attendanceRef, where('date', '==', todayStr));
            const snapA = await getDocs(qA);
            snapA.forEach(d => batch.delete(d.ref));

            const leaveRef = collection(firestore, 'users', user.uid, 'leaveRequests');
            const qL = query(leaveRef, where('startDate', '==', Timestamp.fromDate(startOfDay(targetDate))));
            const snapL = await getDocs(qL);
            snapL.forEach(d => batch.delete(d.ref));

            const newLeaveDoc = doc(leaveRef);
            batch.set(newLeaveDoc, {
                id: newLeaveDoc.id,
                userId: user.uid,
                userName: user.name,
                userRole: user.role,
                type: newStatus === 'Sakit' ? 'Sakit' : 'Izin Pribadi',
                status: 'approved',
                reason: newStatus === 'Sakit' ? 'Sakit' : 'Izin pribadi',
                startDate: Timestamp.fromDate(startOfDay(targetDate)),
                endDate: Timestamp.fromDate(endOfDay(targetDate)),
                createdAt: serverTimestamp(), 
                approvedBy: currentUser.uid, 
                approvedAt: serverTimestamp()
            });

            await batch.commit();
            invalidateCache(); 
            setProblematicDays(prev => prev.filter(p => p.id !== day.id));
            setError(null);
        } catch (err) { 
            console.error("Alpa conversion error:", err);
            setError("Terjadi kesalahan sistem."); 
        } finally { setIsSaving(false); }
    };

    const handleAlpaConversionToAttendance = async (day: any, type: string) => {
        if (!currentUser?.uid || !firestore || !schoolConfig || !user) return;
        
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const recordDate = parseISO(day.date);
            const now = new Date();
            const isToday = isSameDay(recordDate, now);
            const recordRef = doc(firestore, 'users', user.uid, 'attendanceRecords', day.id);

            const inEnd = schoolConfig.checkInEndTime || '07:30';
            const outStart = getDailyOutStart(recordDate, schoolConfig);
            const [hE, mE] = inEnd.split(':').map(Number);
            const limitIn = setMinutes(setHours(startOfDay(recordDate), hE), mE);
            const [hO, mO] = outStart.split(':').map(Number);
            const limitOutStart = setMinutes(setHours(startOfDay(recordDate), hO), mO);

            const fillOut = !isToday || (isToday && now > limitOutStart);

            let data: any = {
                userId: user.uid, date: format(recordDate, 'yyyy-MM-dd'),
                manualEntry: true, updatedBy: currentUser.uid, updatedAt: serverTimestamp(),
                reasonForUpdate: 'Kehadiran penuh'
            };

            // PROTEKSI: Gunakan jam masuk yang sudah ada jika ada
            if (day.checkInTime) {
                data.checkInTime = Timestamp.fromDate(parseISO(day.checkInTime));
            } else if (['hadir', 'lengkapi-masuk', 'dinas-siang', 'pulang-cepat'].includes(type)) {
                const randomOffset = Math.floor(Math.random() * 299) + 1;
                data.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - randomOffset * 1000));
            } else {
                data.checkInTime = null;
            }

            // PROTEKSI: Gunakan jam pulang yang sudah ada jika ada
            if (day.checkOutTime) {
                data.checkOutTime = Timestamp.fromDate(parseISO(day.checkOutTime));
            } else if (fillOut && ['hadir', 'lengkapi-pulang', 'terlambat', 'dinas-pagi'].includes(type)) {
                const randomOffset = Math.floor(Math.random() * 599) + 1;
                data.checkOutTime = Timestamp.fromDate(new Date(limitOutStart.getTime() + randomOffset * 1000));
            } else {
                data.checkOutTime = null;
            }

            if (type === 'terlambat') data.reasonForUpdate = 'Terlambat';
            else if (type === 'dinas-pagi') data.reasonForUpdate = 'Dinas pagi';
            else if (type === 'dinas-siang') data.reasonForUpdate = 'Dinas siang';
            else if (type === 'pulang-cepat') data.reasonForUpdate = 'Pulang cepat';
            else if (type === 'luar-sekolah') data.reasonForUpdate = 'Kegiatan luar sekolah';

            batch.set(recordRef, data, { merge: true });
            await batch.commit();
            invalidateCache(); 
            setProblematicDays(prev => prev.filter(p => p.id !== day.id));
        } catch (err) { setError("Gagal menyimpan perubahan."); }
        finally { setIsSaving(false); }
    };

    const handleSaveChanges = async () => {
        const selectedIds = Object.keys(selectedDays).filter(id => selectedDays[id]);
        if (selectedIds.length === 0 || !schoolConfig) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const now = new Date();
            
            for (const day of problematicDays.filter(d => selectedDays[d.id])) {
                const recordDate = parseISO(day.date);
                const isToday = isSameDay(recordDate, now);
                const outStart = getDailyOutStart(recordDate, schoolConfig);
                const [hO, mO] = outStart.split(':').map(Number);
                const limitOutStart = setMinutes(setHours(startOfDay(recordDate), hO), mO);
                const fillOut = !isToday || (isToday && now > limitOutStart);

                let data: any = {
                    userId: user.uid, date: format(recordDate, 'yyyy-MM-dd'),
                    updatedBy: currentUser.uid, updatedAt: serverTimestamp(),
                    reasonForUpdate: 'Kehadiran penuh', manualEntry: true
                };

                const inEnd = schoolConfig.checkInEndTime || '07:30';
                const [hE, mE] = inEnd.split(':').map(Number);
                const limitIn = setMinutes(setHours(startOfDay(recordDate), hE), mE);
                
                if (day.checkInTime) {
                    data.checkInTime = Timestamp.fromDate(parseISO(day.checkInTime));
                } else {
                    const rIn = Math.floor(Math.random() * 299) + 1;
                    data.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - rIn * 1000));
                }

                if (day.checkOutTime) {
                    data.checkOutTime = Timestamp.fromDate(parseISO(day.checkOutTime));
                } else if (fillOut) {
                    const rOut = Math.floor(Math.random() * 599) + 1;
                    data.checkOutTime = Timestamp.fromDate(new Date(limitOutStart.getTime() + rOut * 1000));
                } else {
                    data.checkOutTime = null;
                }

                batch.set(doc(firestore, 'users', user.uid, 'attendanceRecords', day.id), data, { merge: true });
            }
            await batch.commit();
            invalidateCache(); 
            onClose();
        } catch (err) { setError("Gagal menyimpan perubahan."); }
        finally { setIsSaving(false); }
    };

    const getAdminBadgeClass = (status: string, desc: string) => {
        const s = status.toLowerCase();
        const d = desc.toLowerCase();
        if (s === 'terlambat' || d === 'terlambat') return 'bg-green-600 text-white border-none';
        if (s === 'alpa') return 'bg-red-50 text-red-700 border-red-200';
        if (s === 'sakit') return 'bg-orange-500 text-white border-none';
        if (s === 'izin' || s.includes('izin')) return 'bg-blue-50 text-blue-700 border-blue-200';
        return 'bg-orange-50 text-orange-700 border-orange-200';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-xl border-none shadow-none p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-normal text-primary">Perbaiki kehadiran</DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6">
                {error && <p className="text-destructive mb-4 text-xs font-bold text-center bg-destructive/10 p-2 rounded-lg">{error}</p>}
                {isLoading ? (
                    <div className="py-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                ) : problematicDays.length > 0 ? (
                    <div className="py-4">
                        <DialogDescription className="mb-4 text-sm font-bold text-muted-foreground">Pilih data untuk diperbaiki otomatis atau klik titik tiga untuk ubah status manual.</DialogDescription>
                        <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                            {problematicDays.map(item => {
                                const hasIn = !!item.checkInTime;
                                const hasOut = !!item.checkOutTime;
                                const isAlpa = item.status === 'Alpa';
                                const isManualLate = item.status === 'Terlambat' || item.description === 'Terlambat';
                                
                                return (
                                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 border border-muted-foreground/5 transition-all">
                                        {(isAlpa && !isManualLate) ? <div className="p-1 rounded-full bg-destructive/10"><AlertTriangle className="h-4 w-4 text-destructive" /></div> : <Checkbox checked={!!selectedDays[item.id]} onCheckedChange={() => handleSelectDay(item.id)} />}
                                        <div className="flex flex-col grow">
                                            <label className="text-[13px] font-bold text-foreground leading-none">{format(parseISO(item.date), 'eeee, d MMM', { locale: id })}</label>
                                            <span className="text-[9px] font-medium text-muted-foreground mt-1">{item.description}</span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-none p-2">
                                                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Koreksi Kehadiran</DropdownMenuLabel>
                                                {hasIn && !hasOut ? (
                                                    <>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'hadir')}>Lengkapi absen pulang</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'pulang-cepat')}>Izin pulang cepat</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'dinas-siang')}>Dinas siang</DropdownMenuItem>
                                                    </>
                                                ) : !hasIn && hasOut ? (
                                                    <>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'hadir')}>Lengkapi absen masuk</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'terlambat')}>Jadikan Terlambat</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'dinas-pagi')}>Dinas pagi</DropdownMenuItem>
                                                    </>
                                                ) : (
                                                    <>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'hadir')}>Jadikan Hadir (Penuh)</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'terlambat')}>Jadikan Terlambat</DropdownMenuItem>
                                                    </>
                                                )}
                                                <DropdownMenuSeparator className='my-1.5 opacity-50' />
                                                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-1">Ketidakhadiran</DropdownMenuLabel>
                                                {!hasIn && (
                                                    <>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToLeave(item, 'Sakit')}>Jadikan Sakit</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToLeave(item, 'Izin')}>Jadikan Izin Pribadi</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'dinas-pagi')}>Dinas Pagi</DropdownMenuItem>
                                                    </>
                                                )}
                                                <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'dinas-siang')}>Dinas siang</DropdownMenuItem>
                                                <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'pulang-cepat')}>Pulang cepat</DropdownMenuItem>
                                                {!hasIn && <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleAlpaConversionToAttendance(item, 'luar-sekolah')}>Kegiatan luar sekolah</DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center gap-3"><CheckCircle2 className="h-12 w-12 text-green-500 opacity-20" /><p className="text-sm font-bold text-muted-foreground">Semua data kehadiran sudah rapi.</p></div>
                )}
                </div>
                <DialogFooter className="p-6 pt-0 gap-2">
                    <DialogClose asChild><Button variant="ghost" className="rounded-xl font-bold shadow-none h-11">Batal</Button></DialogClose>
                    <Button onClick={handleSaveChanges} className="rounded-xl font-black bg-primary uppercase text-[10px] tracking-widest shadow-none h-11" disabled={isLoading || isSaving || !Object.values(selectedDays).some(Boolean)}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Lengkapi Terpilih'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
