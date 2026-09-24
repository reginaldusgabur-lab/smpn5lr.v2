'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { format, isValid, parseISO, startOfDay, isSameMonth, subMonths, addMonths, isBefore, isSameDay, setHours, setMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchUserMonthlyReportData, type MonthlyReportData } from '@/lib/attendance';
import { Download, ChevronLeft, ChevronRight, ArrowLeft, Loader2, User, CalendarDays, RefreshCw, Calendar, MoreVertical, PencilLine } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { invalidateCache } from '@/lib/cache';
import { cn } from '@/lib/utils';

const safeFormat = (dateInput: any, formatString: string): string => {
    if (!dateInput) return '-';
    let date: Date;
    if (typeof dateInput === 'string') date = parseISO(dateInput);
    else if (dateInput.toDate) date = dateInput.toDate();
    else date = new Date(dateInput);
    return isValid(date) ? format(date, formatString, { locale: id }) : '-';
};

export default function UserReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const userId = params.userId as string;
    const isMounted = useRef(true);

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [monthlyReportData, setMonthlyReportData] = useState<MonthlyReportData[]>([]);
    const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [academicYear, setAcademicYear] = useState("");

    const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
    const { data: schoolConfigData } = useDoc(currentUser, schoolConfigRef);

    const fetchData = useCallback(async () => {
        if (!firestore || !userId || !schoolConfigData || !currentUser || !isMounted.current) return;
        setIsLoading(true);
        try {
            const userRef = doc(firestore, 'users', userId);
            const mRef = doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'));
            
            const [userSnap, reportData, monthlyConfigSnap] = await Promise.all([
                getDoc(userRef),
                fetchUserMonthlyReportData(firestore, userId, currentMonth, schoolConfigData),
                getDoc(mRef)
            ]);

            if (!userSnap.exists()) throw new Error('User not found');
            
            if (isMounted.current) {
                setUserData(userSnap.data());
                setMonthlyReportData(reportData);
                const mData = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};
                setAcademicYear(mData.academicYear || (schoolConfigData as any).academicYear || "");
            }
        } catch (err) {
            console.error("Fetch Data Error:", err);
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    }, [firestore, userId, currentMonth, schoolConfigData, currentUser]);

    useEffect(() => {
        isMounted.current = true;
        if (schoolConfigData) fetchData();
        return () => { isMounted.current = false; };
    }, [fetchData, schoolConfigData]);

    const getDailyOutStart = useCallback((date: Date) => {
        if (!schoolConfigData) return '14:00';
        const dayOfWeek = date.getDay().toString();
        const dailyOut = (schoolConfigData as any).dailyCheckOutTimes?.[dayOfWeek];
        return dailyOut?.start || (schoolConfigData as any).checkOutStartTime || '14:00';
    }, [schoolConfigData]);

    const handleStatusChange = async (dateStr: string, type: string) => {
        if (!currentUser || !firestore || isMutating || !schoolConfigData || !userData) return;
        setIsMutating(true);
        try {
            const targetDate = parseISO(dateStr);
            const now = new Date();
            const isToday = isSameDay(targetDate, now);
            const outStart = getDailyOutStart(targetDate);
            const [hO, mO] = outStart.split(':').map(Number);
            const limitOutStart = setMinutes(setHours(startOfDay(targetDate), hO), mO);

            const inEnd = (schoolConfigData as any).checkInEndTime || '07:30';
            const [hE, mE] = inEnd.split(':').map(Number);
            const limitIn = setMinutes(setHours(startOfDay(targetDate), hE), mE);

            const batch = writeBatch(firestore);
            const todayStr = format(targetDate, 'yyyy-MM-dd');
            
            const attendanceRef = collection(firestore, 'users', userId, 'attendanceRecords');
            const qA = query(attendanceRef, where('date', '==', todayStr));
            const snapA = await getDocs(qA);
            snapA.forEach(d => batch.delete(d.ref));

            const leaveRef = collection(firestore, 'users', userId, 'leaveRequests');
            const qL = query(leaveRef, where('startDate', '==', Timestamp.fromDate(startOfDay(targetDate))));
            const snapL = await getDocs(qL);
            snapL.forEach(d => batch.delete(d.ref));

            if (['hadir', 'terlambat', 'dinas-pagi', 'dinas-siang', 'pulang-cepat', 'luar-sekolah'].includes(type)) {
                const existingAtt = monthlyReportData.find(d => format(parseISO(d.date), 'yyyy-MM-dd') === todayStr);

                let data: any = {
                    userId, date: todayStr,
                    manualEntry: true, 
                    updatedBy: currentUser.uid, updatedAt: serverTimestamp(),
                };

                // --- LOGIKA JAM MASUK ---
                if (existingAtt?.checkInTime) {
                    data.checkInTime = Timestamp.fromDate(parseISO(existingAtt.checkInTime));
                } else if (['hadir', 'dinas-siang', 'pulang-cepat', 'luar-sekolah'].includes(type)) {
                    if (isToday && now < limitIn) {
                        data.checkInTime = Timestamp.fromDate(now);
                    } else {
                        const randomOffset = Math.floor(Math.random() * 299) + 1; // 1-300 detik
                        data.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - randomOffset * 1000));
                    }
                } else if (type === 'terlambat' || type === 'dinas-pagi') {
                    const randomOffset = Math.floor(Math.random() * 899) + 60; // 1-15 menit telat
                    data.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() + randomOffset * 1000));
                } else {
                    data.checkInTime = null;
                }

                // --- LOGIKA JAM PULANG ---
                if (existingAtt?.checkOutTime) {
                    data.checkOutTime = Timestamp.fromDate(parseISO(existingAtt.checkOutTime));
                } else if (['hadir', 'terlambat', 'dinas-pagi', 'luar-sekolah'].includes(type)) {
                    if (isToday && now > limitOutStart) {
                        data.checkOutTime = Timestamp.fromDate(now);
                    } else {
                        const randomOffset = Math.floor(Math.random() * 599) + 60; // 1-10 menit masuk window
                        data.checkOutTime = Timestamp.fromDate(new Date(limitOutStart.getTime() + randomOffset * 1000));
                    }
                } else if (type === 'pulang-cepat' || type === 'dinas-siang') {
                    if (isToday && now < limitOutStart && (!data.checkInTime || now > data.checkInTime.toDate())) {
                        data.checkOutTime = Timestamp.fromDate(now);
                    } else {
                        const randomOffset = Math.floor(Math.random() * 1800) + 300; // 5-30 menit sebelum window
                        data.checkOutTime = Timestamp.fromDate(new Date(limitOutStart.getTime() - randomOffset * 1000));
                    }
                } else {
                    data.checkOutTime = null;
                }

                if (type === 'terlambat') data.reasonForUpdate = 'Terlambat';
                else if (type === 'dinas-pagi') data.reasonForUpdate = 'Dinas pagi';
                else if (type === 'dinas-siang') data.reasonForUpdate = 'Dinas siang';
                else if (type === 'pulang-cepat') data.reasonForUpdate = 'Pulang cepat';
                else if (type === 'luar-sekolah') data.reasonForUpdate = 'Kegiatan luar sekolah';
                else data.reasonForUpdate = 'Kehadiran penuh';

                batch.set(doc(attendanceRef), data);
            } else {
                const newLeaveDoc = doc(leaveRef);
                batch.set(newLeaveDoc, {
                    id: newLeaveDoc.id,
                    userId, userName: userData.name,
                    type: type === 'sakit' ? 'Sakit' : 'Izin Pribadi',
                    status: 'approved',
                    reason: type === 'sakit' ? 'Sakit' : 'Izin pribadi',
                    startDate: Timestamp.fromDate(startOfDay(targetDate)),
                    endDate: Timestamp.fromDate(endOfDay(targetDate)),
                    createdAt: serverTimestamp(), approvedBy: currentUser.uid, approvedAt: serverTimestamp()
                });
            }
            await batch.commit();
            invalidateCache();
            toast({ title: 'Berhasil', description: 'Status kehadiran telah diperbarui.' });
            fetchData();
        } catch (err) { 
            toast({ variant: 'destructive', title: 'Gagal' }); 
        } finally { setIsMutating(false); }
    };

    const handleDownloadPdf = () => {
        if (!userData || monthlyReportData.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        const margin = 14;
        const config = schoolConfigData || ({} as any);

        doc.setFont('times', 'bold').setFontSize(14).text((config.governmentAgency || 'PEMERINTAH KABUPATEN MANGGARAI').toUpperCase(), centerX, 15, { align: 'center' });
        doc.text((config.educationAgency || 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA').toUpperCase(), centerX, 21, { align: 'center' });
        doc.setFontSize(12).text((config.schoolName || 'SMP NEGERI 5 LANGKE REMBONG').toUpperCase(), centerX, 28, { align: 'center' });
        doc.setFont('times', 'normal').setFontSize(9).text(`Alamat: ${config.address || 'Alamat Sekolah'}`, centerX, 34, { align: 'center' });
        doc.setLineWidth(0.8).line(margin, 38, pageWidth - margin, 38);
        doc.setLineWidth(0.2).line(margin, 38.8, pageWidth - margin, 38.8);

        doc.setFont('times', 'bold').setFontSize(12).text('LAPORAN KEHADIRAN GURU/TENDIK', centerX, 48, { align: 'center' });
        doc.text(`Bulan ${format(currentMonth, 'MMMM yyyy', { locale: id })}`, centerX, 54, { align: 'center' });

        doc.setFontSize(11).setFont('times', 'normal').text(`Nama : ${userData.name}`, margin, 70);
        doc.text(`NIP  : ${userData.nip || '-'}`, margin, 76);

        const tableHead = [['No', 'Tanggal', 'Masuk', 'Pulang', 'Status', 'Keterangan']];
        const tableRows = monthlyReportData.map((item, index) => [
            index + 1,
            safeFormat(item.date, 'eeee, dd MMMM yyyy'),
            safeFormat(item.checkInTime, 'HH:mm:ss'),
            safeFormat(item.checkOutTime, 'HH:mm:ss'),
            item.status,
            item.description || '-'
        ]);

        autoTable(doc, {
            startY: 82,
            head: tableHead,
            body: tableRows,
            theme: 'striped',
            styles: { font: 'times', fontSize: 10, cellPadding: 2 },
            headStyles: { fillColor: [52, 152, 219], textColor: 255, halign: 'center' },
            columnStyles: { 0: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } }
        });

        doc.save(`Laporan_${userData.name.replace(/\s+/g, '_')}.pdf`);
    };

    const isAdmin = currentUser?.role === 'admin';
    const canGoPrev = currentMonth > new Date(2026, 0, 1);
    const canGoNext = !isSameMonth(currentMonth, new Date());

    if (isLoading || !userData) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="px-4 md:px-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <button onClick={() => router.back()} className="h-8 w-8 -ml-2 rounded-full hover:bg-muted flex items-center justify-center transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-normal tracking-tight text-foreground">Detail laporan kehadiran</h1>
                            <p className="text-sm font-bold text-primary flex items-center gap-2"><User className="h-3.5 w-3.5" />{userData.name}</p>
                        </div>
                    </div>
                </div>

                <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><Calendar className="w-24 h-24 text-white" /></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm"><Calendar className="h-6 w-6" /></div>
                                <div className="space-y-0.5">
                                    <h2 className="font-bold text-2xl tracking-tight leading-tight">Riwayat Absensi & Izin</h2>
                                    <p className="text-[11px] font-medium text-white/80 leading-relaxed">Melihat riwayat kehadiran personil.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10 shadow-none" onClick={fetchData} disabled={isMutating}><RefreshCw className={cn("h-4 w-4", isMutating && "animate-spin")} /></Button>
                        </div>
                    </div>

                    <CardContent className="p-0">
                        <div className="p-4 space-y-6">
                            <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border border-muted-foreground/5 p-1">
                                <div className="flex items-center">
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} disabled={!canGoPrev}><ChevronLeft className="h-5 w-5 text-primary" /></Button>
                                    <div className="flex items-center gap-1.5 pl-0.5 pr-2 border-r border-muted-foreground/10 mr-1 min-w-max">
                                        <CalendarDays className="h-4 w-4 text-primary/70" />
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-bold text-muted-foreground/50 leading-none">Tahun ajaran</span>
                                            <span className="text-[10px] font-black text-primary leading-none mt-0.5 whitespace-nowrap">{academicYear}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-primary capitalize min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={!canGoNext}><ChevronRight className="h-5 w-5 text-primary" /></Button>
                                </div>
                            </div>
                            <div className="flex justify-end"><Button onClick={handleDownloadPdf} disabled={monthlyReportData.length === 0} className="w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 h-11 rounded-xl text-xs active:scale-[0.98] transition-all"><Download className="mr-2 h-4 w-4" />unduh pdf</Button></div>
                        </div>

                        <div className="border-t border-muted-foreground/5 overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none h-11">
                                        <TableHead className="w-[60px] text-center font-bold text-xs text-muted-foreground border-none h-11">No</TableHead>
                                        <TableHead className="w-[200px] font-bold text-xs text-muted-foreground border-none h-11">Tanggal</TableHead>
                                        <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Masuk</TableHead>
                                        <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Pulang</TableHead>
                                        <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Status</TableHead>
                                        <TableHead className="font-bold text-xs text-muted-foreground border-none h-11">Keterangan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlyReportData.length > 0 ? monthlyReportData.map((item, index) => {
                                        const hasIn = !!item.checkInTime;
                                        const hasOut = !!item.checkOutTime;
                                        const isAlpa = item.status === 'Alpa';
                                        const isToday = isSameDay(parseISO(item.date), new Date());
                                        const canEdit = isAdmin;

                                        return (
                                            <TableRow key={item.id} className="hover:bg-muted/20 border-muted-foreground/5 transition-colors">
                                                <TableCell className="text-center font-bold text-muted-foreground text-sm">{index + 1}</TableCell>
                                                <TableCell className="font-bold text-sm text-foreground whitespace-nowrap">{safeFormat(item.date, 'eeee, d MMMM yyyy')}</TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold">{safeFormat(item.checkInTime, 'HH:mm:ss')}</TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-foreground">{safeFormat(item.checkOutTime, 'HH:mm:ss')}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Badge className={cn("px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap border-none shadow-sm", isAlpa ? "bg-red-500 text-white" : "bg-emerald-500 text-white")}>
                                                            {isAlpa ? 'ALPA' : 'HADIR'}
                                                        </Badge>
                                                        {canEdit && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><button className="h-8 w-8 rounded-full hover:bg-primary/10 flex items-center justify-center transition-all active:scale-90"><PencilLine className="h-4 w-4 text-primary" /></button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-2xl border-none p-2 animate-in zoom-in-95 duration-200">
                                                                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Koreksi Cepat</DropdownMenuLabel>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'hadir')}>Jadikan Hadir (Penuh)</DropdownMenuItem>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'terlambat')}>Jadikan Terlambat</DropdownMenuItem>
                                                                    <DropdownMenuSeparator className='my-1.5 opacity-50' />
                                                                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-1">Ketidakhadiran</DropdownMenuLabel>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'sakit')}>Jadikan Sakit</DropdownMenuItem>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'izin')}>Jadikan Izin Pribadi</DropdownMenuItem>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'dinas-pagi')}>Dinas Pagi</DropdownMenuItem>
                                                                    <DropdownMenuItem 
                                                                        className="rounded-xl py-2.5 px-3 font-bold text-xs" 
                                                                        onClick={() => handleStatusChange(item.date, 'dinas-siang')}
                                                                        disabled={isToday && !hasIn}
                                                                    >
                                                                        Dinas siang
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem 
                                                                        className="rounded-xl py-2.5 px-3 font-bold text-xs" 
                                                                        onClick={() => handleStatusChange(item.date, 'pulang-cepat')}
                                                                        disabled={isToday && !hasIn}
                                                                    >
                                                                        Pulang cepat
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'luar-sekolah')}>Kegiatan luar sekolah</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-[11px] font-medium text-muted-foreground italic whitespace-nowrap">{item.description}</TableCell>
                                            </TableRow>
                                        );
                                    }) : <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold text-xs tracking-widest opacity-40">Tidak ada data.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
