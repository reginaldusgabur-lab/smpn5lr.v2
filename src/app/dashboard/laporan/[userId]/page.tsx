
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { format, isValid, parseISO, startOfDay, endOfDay, isSameMonth, startOfMonth, endOfMonth, setHours, setMinutes, subMonths, addMonths, isBefore, isSameDay, addMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchUserMonthlyReportData, calculateAttendanceStats, type MonthlyReportData } from '@/lib/attendance';
import { Download, ChevronLeft, ChevronRight, ArrowLeft, Loader2, MoreVertical, TrendingUp, User, CalendarDays, PieChart as PieIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { invalidateCache } from '@/lib/cache';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

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
    const [stats, setStats] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [academicYear, setAcademicYear] = useState("");

    const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
    const { data: schoolConfigData } = useDoc(currentUser, schoolConfigRef);

    const fetchData = useCallback(async () => {
        if (!firestore || !userId || !schoolConfigData || !currentUser || !isMounted.current) return;
        setIsLoading(true);
        setError(null);
        try {
            const userRef = doc(firestore, 'users', userId);
            const monthlyConfigRef = doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'));
            
            const [userSnap, reportData, reportStats, monthlyConfigSnap] = await Promise.all([
                getDoc(userRef),
                fetchUserMonthlyReportData(firestore, userId, currentMonth, schoolConfigData),
                calculateAttendanceStats(firestore, userId, { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
                getDoc(monthlyConfigRef)
            ]);

            if (!userSnap.exists()) throw new Error('Profil staf tidak ditemukan.');
            
            if (isMounted.current) {
                setUserData(userSnap.data());
                setMonthlyReportData(reportData);
                setStats(reportStats);
                
                const mData = monthlyConfigSnap.exists() ? monthlyConfigSnap.data() : {};
                setAcademicYear(mData.academicYear || schoolConfigData.academicYear || "");
            }
        } catch (err: any) {
            console.error("Fetch Data Error:", err);
            if (isMounted.current) setError('Gagal memuat data laporan.');
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    }, [firestore, userId, currentMonth, schoolConfigData, currentUser]);

    useEffect(() => {
        isMounted.current = true;
        if (schoolConfigData) fetchData();
        return () => { isMounted.current = false; };
    }, [fetchData, schoolConfigData]);

    const chartData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Hadir', value: Math.ceil(stats.totalHadir), color: '#22c55e' },
            { name: 'Izin', value: stats.totalIzin, color: '#3b82f6' },
            { name: 'Sakit', value: stats.totalSakit, color: '#f97316' },
            { name: 'Alpa', value: stats.totalAlpa, color: '#ef4444' },
        ];
    }, [stats]);

    const getDailyOutStart = useCallback((date: Date) => {
        if (!schoolConfigData) return '14:00';
        const dayOfWeek = date.getDay().toString();
        const dailyOut = (schoolConfigData as any).dailyCheckOutTimes?.[dayOfWeek];
        return dailyOut?.start || (schoolConfigData as any).checkOutStartTime || '14:00';
    }, [schoolConfigData]);

    const generateRandomOutTime = useCallback((date: Date) => {
        const outStart = getDailyOutStart(date);
        const [h, m] = outStart.split(':').map(Number);
        const base = setMinutes(setHours(startOfDay(date), h), m);
        const randomMins = Math.floor(Math.random() * 20) + 5;
        const randomSecs = Math.floor(Math.random() * 60);
        return Timestamp.fromDate(addMinutes(new Date(base.getTime() + randomSecs * 1000), randomMins));
    }, [getDailyOutStart]);

    const handleStatusChange = async (dateStr: string, newStatus: string, reason: string) => {
        if (!currentUser || !firestore || isMutating || !schoolConfigData || !userData) return;
        setIsMutating(true);
        try {
            const targetDate = parseISO(dateStr);
            const now = new Date();
            const isToday = isSameDay(targetDate, now);
            const outStart = getDailyOutStart(targetDate);
            const [hO, mO] = outStart.split(':').map(Number);
            const limitOutStart = setMinutes(setHours(startOfDay(targetDate), hO), mO);
            
            const fillOut = !isToday || (isToday && now > limitOutStart);

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

            if (['Dinas Pagi', 'Dinas Siang', 'Pulang Cepat', 'Terlambat', 'Kegiatan Luar Sekolah'].includes(newStatus)) {
                const inEnd = (schoolConfigData as any).checkInEndTime || '07:30';
                const [hE, mE] = inEnd.split(':').map(Number);
                const limitIn = setMinutes(setHours(startOfDay(targetDate), hE), mE);
                
                let dataToSave: any = {
                    userId, date: todayStr,
                    manualEntry: true, 
                    reasonForUpdate: reason,
                    updatedBy: currentUser.uid, updatedAt: serverTimestamp(),
                };

                if (newStatus === 'Dinas Pagi' || newStatus === 'Terlambat' || newStatus === 'Kegiatan Luar Sekolah') {
                    dataToSave.checkInTime = null;
                    dataToSave.checkOutTime = fillOut ? generateRandomOutTime(targetDate) : null;
                } else if (newStatus === 'Dinas Siang') {
                    const randomSeconds = Math.floor(Math.random() * 299) + 1; 
                    dataToSave.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - randomSeconds * 1000));
                    dataToSave.checkOutTime = null;
                } else { // Pulang Cepat
                     const randomSeconds = Math.floor(Math.random() * 299) + 1; 
                     dataToSave.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - randomSeconds * 1000));
                     dataToSave.checkOutTime = null;
                }

                batch.set(doc(attendanceRef), dataToSave);
            } else {
                const newLeaveDoc = doc(leaveRef);
                batch.set(newLeaveDoc, {
                    id: newLeaveDoc.id,
                    userId, userName: userData.name, userRole: userData.role,
                    type: newStatus === 'Sakit' ? 'Sakit' : 'Izin',
                    status: 'approved', reason: reason,
                    startDate: Timestamp.fromDate(startOfDay(targetDate)),
                    endDate: Timestamp.fromDate(endOfDay(targetDate)),
                    createdAt: serverTimestamp(), approvedBy: currentUser.uid, approvedAt: serverTimestamp()
                });
            }

            await batch.commit();
            invalidateCache();
            toast({ title: 'Berhasil', description: `Status diperbarui menjadi ${reason}.` });
            fetchData();
        } catch (err: any) { 
            console.error("Status update error:", err);
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengubah status.' }); 
        } finally { setIsMutating(false); }
    };

    const handleSetHadir = async (item: MonthlyReportData) => {
        if (!currentUser || !firestore || !schoolConfigData || isMutating) return;
        setIsMutating(true);
        try {
            const targetDate = parseISO(item.date);
            const now = new Date();
            const isToday = isSameDay(targetDate, now);
            const outStart = getDailyOutStart(targetDate);
            const [hO, mO] = outStart.split(':').map(Number);
            const limitOutStart = setMinutes(setHours(startOfDay(targetDate), hO), mO);
            
            const fillOut = !isToday || (isToday && now >= limitOutStart);

            const batch = writeBatch(firestore);
            const inEnd = (schoolConfigData as any).checkInEndTime || '07:30';
            const [inH, inM] = inEnd.split(':').map(Number);
            const limitIn = setMinutes(setHours(startOfDay(targetDate), inH), inM);

            const data: any = {
                userId, date: format(targetDate, 'yyyy-MM-dd'),
                manualEntry: true, reasonForUpdate: 'Kehadiran penuh', 
                updatedBy: currentUser.uid, updatedAt: serverTimestamp()
            };

            const randomSeconds = Math.floor(Math.random() * 299) + 1;
            data.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - randomSeconds * 1000));
            data.checkOutTime = fillOut ? generateRandomOutTime(targetDate) : null;

            const q = query(collection(firestore, 'users', userId, 'attendanceRecords'), where('date', '==', format(targetDate, 'yyyy-MM-dd')));
            const snap = await getDocs(q);

            if (!snap.empty) batch.update(snap.docs[0].ref, data);
            else batch.set(doc(collection(firestore, 'users', userId, 'attendanceRecords')), data);

            await batch.commit();
            invalidateCache();
            toast({ title: 'Berhasil', description: fillOut ? 'Kehadiran dipulihkan.' : 'Absen masuk diaktifkan. Pengguna tetap bisa scan pulang nanti.' });
            fetchData();
        } catch (err) { toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui data.' }); }
        finally { setIsMutating(false); }
    };

    const handleDownloadPdf = () => {
        if (!userData || monthlyReportData.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        const margin = 14;
        const config = schoolConfigData || ({} as any);

        doc.setFont('times', 'bold').setFontSize(14);
        doc.text((config.governmentAgency || 'PEMERINTAH KABUPATEN MANGGARAI').toUpperCase(), centerX, 15, { align: 'center' });
        doc.text((config.educationAgency || 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA').toUpperCase(), centerX, 21, { align: 'center' });
        doc.setFontSize(12);
        doc.text((config.schoolName || 'SMP NEGERI 5 LANGKE REMBONG').toUpperCase(), centerX, 28, { align: 'center' });
        doc.setFont('times', 'normal').setFontSize(9);
        doc.text(`Alamat: ${config.address || 'Alamat Sekolah'}`, centerX, 34, { align: 'center' });
        
        doc.setLineWidth(0.8).line(margin, 38, pageWidth - margin, 38);
        doc.setLineWidth(0.2).line(margin, 38.8, pageWidth - margin, 38.8);

        doc.setFont('times', 'bold').setFontSize(12);
        doc.text('LAPORAN KEHADIRAN GURU/TENDIK', centerX, 48, { align: 'center' });
        doc.text(`Bulan ${format(currentMonth, 'MMMM yyyy', { locale: id })}`, centerX, 54, { align: 'center' });
        doc.setFontSize(10).setFont('times', 'normal');
        doc.text(`Tahun Ajaran: ${academicYear || config.academicYear || '-'}`, centerX, 60, { align: 'center' });

        let currentY = 70;

        doc.setFontSize(11).setFont('times', 'normal');
        doc.text(`Nama : ${userData.name}`, margin, currentY); currentY += 6;
        doc.text(`NIP : ${userData.nip || '-'}`, margin, currentY); currentY += 6;
        
        const posLabel = (userData.position || '-').replace('PPPK Paruh Waktu (PW)', 'PPPK PW');
        const displayRole = (userData.role || 'user').replace('_', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        doc.text(`Jabatan/Status : ${displayRole} / ${posLabel}`, margin, currentY);
        currentY += 10;

        const tableHead = [['No', 'Tanggal', 'Masuk', 'Pulang', 'Status', 'Keterangan']];
        const tableRows = monthlyReportData.map((item, index) => [
            index + 1,
            safeFormat(item.date, 'eeee, dd MMMM yyyy'),
            (item.status === 'Terlambat' || item.description === 'Terlambat' && !item.checkInTime) ? '-' : safeFormat(item.checkInTime, 'HH:mm:ss'),
            safeFormat(item.checkOutTime, 'HH:mm:ss'),
            (item.status === 'Terlambat' || item.description === 'Terlambat') ? 'Hadir' : item.status,
            item.description || '-'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: tableRows,
            theme: 'striped',
            margin: { bottom: 35 },
            styles: { 
              font: 'times', 
              fontSize: 10, 
              cellPadding: 1.5,
              valign: 'middle',
              textColor: [0, 0, 0],
              lineColor: [200, 200, 200], 
              lineWidth: 0.1
            },
            headStyles: { 
                fillColor: [52, 152, 219], 
                textColor: 255, 
                halign: 'center', 
                valign: 'middle',
                fontStyle: 'bold',
                minCellHeight: 12,
                lineWidth: 0
            },
            columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center', cellWidth: 32 }, 3: { halign: 'center', cellWidth: 32 }, 4: { halign: 'center', cellWidth: 25 } }
        });

        let finalY = (doc as any).lastAutoTable.finalY || currentY;
        if (finalY > doc.internal.pageSize.getHeight() - 65) {
            doc.addPage();
            finalY = 20;
        }

        const signatureX = pageWidth - 85;
        const signatureY = finalY + 15;
        const today = format(new Date(), 'd MMMM yyyy', { locale: id });

        doc.setFontSize(10).setFont('times', 'normal');
        doc.text(`${config.reportCity || 'Mando'}, ${today}`, signatureX, signatureY);
        doc.text('Mengetahui,', signatureX, signatureY + 6);
        doc.text('Kepala Sekolah', signatureX, signatureY + 12);
        
        doc.setFont('times', 'bold');
        doc.text(config.headmasterName || 'Lodovikus Jangkar, S.Pd.Gr', signatureX, signatureY + 38);
        doc.setFont('times', 'normal');
        doc.text(`NIP. ${config.headmasterNip || '-'}`, signatureX, signatureY + 44);

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setLineWidth(0.2);
            doc.setDrawColor(0, 0, 0);
            doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
            doc.setFontSize(8).setFont('times', 'italic');
            doc.text('Dokumen absensi ini adalah dokumen resmi yang dibuat secara otomatis oleh aplikasi.', margin, pageHeight - 10);
            doc.setFontSize(9).setFont('times', 'normal');
            doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }

        doc.save(`Laporan_Individu_${userData.name.replace(/\s+/g, '_')}_${format(currentMonth, 'MMMM_yyyy', { locale: id })}.pdf`);
    };

    const isAdmin = currentUser?.role === 'admin';
    const canGoPrev = currentMonth > new Date(2026, 0, 1);
    const canGoNext = !isSameMonth(currentMonth, new Date());

    const getAdminBadgeClass = (status: string, desc: string) => {
        const s = status.toLowerCase();
        const d = desc.toLowerCase();
        if (s === 'terlambat' || d === 'terlambat') return 'bg-green-600 text-white border-none';
        if (s === 'alpa') return 'bg-red-50 text-red-700 border-red-200';
        if (s === 'sakit') return 'bg-orange-500 text-white border-none';
        if (s === 'izin' || s.includes('izin pribadi')) return 'bg-blue-50 text-blue-700 border-blue-200';
        if (s.includes('dinas') || s.includes('kegiatan')) return 'bg-purple-50 text-purple-700 border-purple-200';
        return 'bg-orange-50 text-orange-700 border-orange-200';
    };

    return (
        <div className="flex-1 pt-2 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="px-4 md:px-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <button onClick={() => router.back()} className="h-8 w-8 -ml-2 rounded-full hover:bg-muted flex items-center justify-center transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-normal tracking-tight text-foreground">Detail laporan kehadiran</h1>
                            {userData && <p className="text-sm font-bold text-primary flex items-center gap-2"><User className="h-3.5 w-3.5" />{userData.name}</p>}
                        </div>
                    </div>
                </div>

                <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl bg-card">
                    <CardContent className="p-0">
                        <div className="p-4 space-y-6">
                            <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border border-muted-foreground/5 p-1">
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl shrink-0" 
                                            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} 
                                            disabled={isLoading || !canGoPrev}
                                        >
                                            <ChevronLeft className="h-5 w-5 text-primary" />
                                        </Button>
                                        <div className="flex items-center gap-2 px-3 min-w-max">
                                            <CalendarDays className="h-4 w-4 text-primary/70" />
                                            <div className="flex flex-col min-w-max">
                                                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">THN AJARAN</span>
                                                <span className="text-[10px] font-black text-primary leading-none mt-0.5 whitespace-nowrap">{academicYear || "-"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xl text-primary tracking-tight text-center capitalize whitespace-nowrap min-w-[120px]">
                                            {format(currentMonth, 'MMMM yyyy', { locale: id })}
                                        </span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl shrink-0" 
                                            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} 
                                            disabled={isLoading || !canGoNext}
                                        >
                                            <ChevronRight className="h-5 w-5 text-primary" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end max-w-2xl mx-auto">
                                <Button onClick={handleDownloadPdf} disabled={monthlyReportData.length === 0 || isLoading || isMutating} className="w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 h-11 rounded-xl text-xs shadow-none active:scale-[0.98] transition-all">
                                    {isLoading || isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}unduh pdf
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-muted-foreground/10 overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">No</TableHead>
                                        <TableHead className="w-[200px] font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Tanggal</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Masuk</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Pulang</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Status</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Keterangan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(8)].map((_, i) => (
                                            <TableRow key={i} className="border-muted-foreground/5">
                                                <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-20 mx-auto rounded-full" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : monthlyReportData.length > 0 ? (
                                        monthlyReportData.map((item, index) => {
                                            const isAlpa = item.status === 'Alpa';
                                            const hasIn = !!item.checkInTime;
                                            const hasOut = !!item.checkOutTime;
                                            const isLeave = ['Sakit', 'Izin', 'Dinas'].some(s => item.status.includes(s));
                                            const isComplete = hasIn && hasOut;
                                            const isManualLate = item.status === 'Terlambat' || item.description === 'Terlambat';
                                            const displayStatus = isManualLate ? 'Hadir' : item.status;

                                            return (
                                                <TableRow key={item.id} className={cn("border-muted-foreground/5 hover:bg-muted/20 transition-colors", isAlpa && "bg-destructive/5")}>
                                                    <TableCell className='text-center font-bold text-muted-foreground text-sm'>{index + 1}</TableCell>
                                                    <TableCell className="whitespace-nowrap font-bold text-sm text-foreground">{safeFormat(item.date, 'eeee, dd MMMM yyyy')}</TableCell>
                                                    <TableCell className='text-center font-mono text-xs font-bold'>
                                                        {(isManualLate && !hasIn) ? (
                                                            <span className="text-red-600 font-black">-</span>
                                                        ) : (
                                                            <span className="text-foreground">{safeFormat(item.checkInTime, 'HH:mm:ss')}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className='text-center font-mono text-xs font-bold text-foreground'>{safeFormat(item.checkOutTime, 'HH:mm:ss')}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isAdmin && !isLeave && !isComplete ? (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm" className={cn("font-bold text-[9px] h-7 rounded-lg shadow-none flex items-center justify-center gap-1", getAdminBadgeClass(item.status, item.description))}>
                                                                        {displayStatus} <MoreVertical className="h-3 w-3" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-none p-2">
                                                                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Koreksi Kehadiran</DropdownMenuLabel>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleSetHadir(item)}>{hasIn ? 'Lengkapi absen pulang' : 'Jadikan Hadir'}</DropdownMenuItem>
                                                                    {!hasIn && <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Terlambat', 'Terlambat')}>Jadikan Terlambat</DropdownMenuItem>}
                                                                    <DropdownMenuSeparator className='my-1.5 opacity-50' />
                                                                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Ubah Status</DropdownMenuLabel>
                                                                    {!hasIn && (
                                                                        <>
                                                                            <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Sakit', 'Sakit')}>Jadikan Sakit</DropdownMenuItem>
                                                                            <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Izin', 'Izin pribadi')}>Jadikan Izin</DropdownMenuItem>
                                                                            <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Dinas Pagi', 'Dinas pagi')}>Dinas pagi</DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Dinas Siang', 'Dinas siang')}>Dinas siang</DropdownMenuItem>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Kegiatan Luar Sekolah', 'Kegiatan luar sekolah')}>Kegiatan luar sekolah</DropdownMenuItem>
                                                                    <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Pulang Cepat', 'Pulang cepat')}>Pulang cepat</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        ) : (
                                                            <span className={cn("inline-flex items-center px-3 py-0.5 rounded-full text-[9px] font-bold", 
                                                                (displayStatus === 'Hadir') ? 'bg-green-100 text-green-700' : 
                                                                (displayStatus === 'Sakit') ? 'bg-orange-500 text-white' : 
                                                                (displayStatus === 'Alpa') ? 'bg-red-100 text-red-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            )}>
                                                                {displayStatus}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-muted-foreground font-bold italic">{item.description || '-'}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold uppercase text-xs tracking-widest">Tidak ada data untuk periode ini.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {!isLoading && stats && (
                    <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl bg-card">
                        <CardHeader className="p-6 border-b border-muted-foreground/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <PieIcon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold">Presentasi kehadiran</CardTitle>
                                        <CardDescription className="text-xs font-medium">Visualisasi performa kehadiran personil bulan ini.</CardDescription>
                                    </div>
                                </div>
                                <div className="bg-primary/5 px-6 py-4 rounded-[2rem] text-center min-w-[120px]">
                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">Skor akhir</p>
                                    <p className="text-lg font-black text-primary leading-none">{stats.persentase}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[340px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={110}
                                            paddingAngle={6}
                                            dataKey="value"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip 
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                            itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                                            formatter={(value) => [`${value} hari`, 'Jumlah']}
                                        />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={40} 
                                            formatter={(value, entry: any) => (
                                                <span className="text-[11px] font-medium text-muted-foreground mx-1">
                                                    {value}: <span className="text-foreground">{entry.payload.value} hari</span>
                                                </span>
                                            )}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
