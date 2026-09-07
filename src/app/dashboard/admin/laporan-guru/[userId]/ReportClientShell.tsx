
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, startOfMonth, parseISO, isValid, endOfMonth, endOfDay, startOfDay, addMonths, subMonths, isBefore, isSameMonth, addMinutes, setHours, setMinutes, isSameDay } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { doc, writeBatch, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger, 
    DropdownMenuSeparator, 
    DropdownMenuLabel 
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight, RefreshCw, Calendar, FileText, CalendarDays, ArrowLeft, Loader2, User, MoreVertical, Info, Calculator, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invalidateCache } from '@/lib/cache';

interface ReportDetail {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  description: string;
  points?: number;
}

interface UserData { name?: string; role?: string; nip?: string; position?: string; }
interface ClientShellProps {
  userId: string;
  initialUserData: UserData;
  initialReportData: ReportDetail[];
  initialMonth: string;
  initialSchoolConfig: any;
  initialMonthlyConfig: any;
}

const PointLegend = () => (
    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Hadir / Dinas</p>
            <p className="text-sm font-black text-green-600">1.0 Poin</p>
        </div>
        <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Telat / Izin Cepat</p>
            <p className="text-sm font-black text-amber-600">0.95 Poin</p>
        </div>
        <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Sakit / Izin</p>
            <p className="text-sm font-black text-blue-600">0.9 - 0.7 Poin</p>
        </div>
        <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Lupa Absen / Alpa</p>
            <p className="text-sm font-black text-red-600">0.5 - 0.0 Poin</p>
        </div>
    </div>
);

export default function ReportClientShell({ 
    userId, 
    initialUserData,
    initialReportData,
    initialMonth,
    initialSchoolConfig,
    initialMonthlyConfig
}: ClientShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();

    const [userData] = useState<UserData>(initialUserData);
    const [reportDetails] = useState<ReportDetail[]>(initialReportData || []);
    const [isMutating, setIsMutating] = useState(false);

    const parsedInitialMonth = parseISO(initialMonth);
    const [currentMonth] = useState(isValid(parsedInitialMonth) ? parsedInitialMonth : new Date());

    const stats = useMemo(() => {
        if (!reportDetails.length) return { totalPoints: "0.00", persentase: "0.0%" };
        const total = reportDetails.reduce((acc, curr) => acc + (curr.points || 0), 0);
        const count = reportDetails.length;
        const perc = (total / (count || 1)) * 100;
        return {
            totalPoints: total.toFixed(2),
            persentase: Math.min(perc, 100).toFixed(1) + "%"
        };
    }, [reportDetails]);

    const handleMonthChange = (amount: number) => {
        const newMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 15);
        router.push(`${pathname}?month=${format(newMonthDate, 'yyyy-MM')}`);
    };
    
    const safeFormat = (date: string | Date | null, formatString: string): string => {
        if (!date) return '-';
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return isValid(dateObj) ? format(dateObj, formatString, { locale: indonesiaLocale }) : '-';
    }

    const getDailyOutStart = (date: Date) => {
        if (!initialSchoolConfig) return '14:00';
        const dayOfWeek = date.getDay().toString();
        const dailyOut = initialSchoolConfig.dailyCheckOutTimes?.[dayOfWeek];
        return dailyOut?.start || initialSchoolConfig.checkOutStartTime || '14:00';
    };

    const handleStatusChange = async (dateStr: string, type: string) => {
        if (!authUser || !firestore || isMutating) return;
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

            const inEnd = initialSchoolConfig?.checkInEndTime || '07:30';
            const [hE, mE] = inEnd.split(':').map(Number);
            const limitIn = setMinutes(setHours(startOfDay(targetDate), hE), mE);

            if (['hadir', 'terlambat', 'dinas-pagi', 'dinas-siang', 'pulang-cepat', 'lengkapi-masuk', 'lengkapi-pulang'].includes(type)) {
                const currentItem = reportDetails.find(d => d.date.startsWith(todayStr));
                
                let data: any = {
                    userId, date: todayStr,
                    manualEntry: true,
                    updatedBy: authUser.uid,
                    updatedAt: serverTimestamp()
                };

                if (currentItem?.checkInTime) {
                    data.checkInTime = Timestamp.fromDate(parseISO(currentItem.checkInTime));
                } else if (['hadir', 'lengkapi-masuk', 'dinas-siang', 'pulang-cepat'].includes(type)) {
                    const randomInOffset = Math.floor(Math.random() * 299) + 1;
                    data.checkInTime = Timestamp.fromDate(new Date(limitIn.getTime() - randomInOffset * 1000));
                } else {
                    data.checkInTime = null;
                }

                if (currentItem?.checkOutTime) {
                    data.checkOutTime = Timestamp.fromDate(parseISO(currentItem.checkOutTime));
                } else if (fillOut && ['hadir', 'lengkapi-pulang', 'terlambat', 'dinas-pagi'].includes(type)) {
                    const randomOutOffset = Math.floor(Math.random() * 599) + 1;
                    data.checkOutTime = Timestamp.fromDate(new Date(limitOutStart.getTime() + randomOutOffset * 1000));
                } else {
                    data.checkOutTime = null;
                }

                if (type === 'terlambat') data.reasonForUpdate = 'Terlambat';
                else if (type === 'dinas-pagi') data.reasonForUpdate = 'Dinas pagi';
                else if (type === 'dinas-siang') data.reasonForUpdate = 'Dinas siang';
                else if (type === 'pulang-cepat') data.reasonForUpdate = 'Pulang cepat';
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
                    createdAt: serverTimestamp(), approvedBy: authUser.uid, approvedAt: serverTimestamp()
                });
            }

            await batch.commit();
            invalidateCache();
            toast({ title: 'Berhasil', description: 'Status kehadiran telah diperbarui.' });
            router.refresh();
        } catch (err) { toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan sistem.' }); }
        finally { setIsMutating(false); }
    };

    const handleDownloadPdf = () => {
        if (!userData || reportDetails.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const centerX = pageWidth / 2;
        const margin = 14;
        const config = initialSchoolConfig || ({} as any);
        const mConfig = initialMonthlyConfig || ({} as any);

        doc.setFont('times', 'bold').setFontSize(14).text((config.governmentAgency || 'PEMERINTAH KABUPATEN MANGGARAI').toUpperCase(), centerX, 15, { align: 'center' });
        doc.text((config.educationAgency || 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA').toUpperCase(), centerX, 21, { align: 'center' });
        doc.setFontSize(12).text((config.schoolName || 'SMP NEGERI 5 LANGKE REMBONG').toUpperCase(), centerX, 28, { align: 'center' });
        doc.setFont('times', 'normal').setFontSize(9).text(`Alamat: ${config.address || 'Alamat Sekolah'}`, centerX, 34, { align: 'center' });
        doc.setLineWidth(0.8).line(margin, 38, pageWidth - margin, 38);
        doc.setLineWidth(0.2).line(margin, 38.8, pageWidth - margin, 38.8);

        doc.setFont('times', 'bold').setFontSize(12).text('LAPORAN KEHADIRAN GURU/TENDIK', centerX, 48, { align: 'center' });
        doc.text(`Bulan ${format(currentMonth, 'MMMM yyyy', { locale: indonesiaLocale })}`, centerX, 54, { align: 'center' });
        doc.setFontSize(10).setFont('times', 'normal').text(`Tahun Ajaran: ${mConfig.academicYear || config.academicYear || '-'}`, centerX, 60, { align: 'center' });

        let currentY = 70;
        doc.setFontSize(11).setFont('times', 'normal').text(`Nama : ${userData.name}`, margin, currentY); currentY += 6;
        doc.text(`NIP : ${userData.nip || '-'}`, margin, currentY); currentY += 10;

        const tableHead = [['No', 'Tanggal', 'Masuk', 'Pulang', 'Status', 'Keterangan']];
        const tableRows = reportDetails.map((item, index) => [
            index + 1,
            safeFormat(item.date, 'eeee, dd MMM yyyy'),
            item.checkInTime ? format(parseISO(item.checkInTime), 'HH:mm:ss') : '-',
            item.checkOutTime ? format(parseISO(item.checkOutTime), 'HH:mm:ss') : '-',
            item.status,
            item.description || '-'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: tableRows,
            theme: 'striped',
            margin: { bottom: 65 },
            styles: { font: 'times', fontSize: 10, cellPadding: 1.0, valign: 'middle', textColor: [0, 0, 0], lineWidth: 0, fillColor: [248, 250, 252] },
            headStyles: { fillColor: [52, 152, 219], textColor: 255, halign: 'center', fontStyle: 'bold', minCellHeight: 12 },
            alternateRowStyles: { fillColor: [225, 242, 254] },
            columnStyles: { 0: { halign: 'center', cellWidth: 10 } }
        });

        // --- SMART PAGE LOGIC ---
        const signatureHeight = 45;
        const notesLineHeight = 5;
        const notesHeaderHeight = 12;
        let notesHeight = 0;
        if (mConfig.isHolidayNotesActive) {
            notesHeight = notesHeaderHeight + (mConfig.holidayNotes?.length || 0) * notesLineHeight;
        }
        
        const totalFooterSpaceNeeded = signatureHeight + notesHeight + 15;
        const currentYPos = (doc as any).lastAutoTable.finalY;
        const bottomSafeLimit = pageHeight - 20;

        if (currentYPos + totalFooterSpaceNeeded > bottomSafeLimit) {
            doc.addPage();
            currentY = 20;
        } else {
            currentY = currentYPos + 10;
        }

        if (mConfig.isHolidayNotesActive) {
            doc.setTextColor(0, 0, 0).setFontSize(10).setFont('times', 'bold').text(`Hari Kerja Efektif: ${mConfig.manualWorkDays || '-'} Hari`, margin, currentY);
            currentY += 8;
            
            if (mConfig.holidayNotes?.length > 0) {
                doc.setFontSize(10).text('Keterangan Hari Libur:', margin, currentY);
                currentY += 5;
                mConfig.holidayNotes.forEach((n: any, i: number) => {
                    if (n.isRed) doc.setTextColor(255, 0, 0).setFont('times', 'bold');
                    else doc.setTextColor(0, 0, 0).setFont('times', 'normal');
                    
                    const txt = `${i + 1}. Tanggal ${n.date || '-'}: ${n.content || '-'}`;
                    const split = doc.splitTextToSize(txt, pageWidth - (margin * 2));
                    doc.text(split, margin, currentY);
                    currentY += (split.length * notesLineHeight);
                });
            }
        }

        currentY = Math.max(currentY, (doc as any).lastAutoTable.finalY + 15);
        if (currentY + signatureHeight > bottomSafeLimit) {
            doc.addPage();
            currentY = 20;
        }

        const sigX = pageWidth - 85;
        const todayStr = format(new Date(), 'd MMMM yyyy', { locale: indonesiaLocale });
        doc.setTextColor(0, 0, 0).setFontSize(10).setFont('times', 'normal').text(`${config.reportCity || 'Mando'}, ${todayStr}`, sigX, currentY);
        doc.text('Mengetahui,', sigX, currentY + 6);
        doc.text('Kepala Sekolah', sigX, currentY + 12);
        doc.setFont('times', 'bold').text(config.headmasterName || 'Lodovikus Jangkar, S.Pd.Gr', sigX, currentY + 38);
        doc.setFont('times', 'normal').text(`NIP. ${config.headmasterNip || '-'}`, sigX, currentY + 44);

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            const ph = doc.internal.pageSize.getHeight();
            doc.setTextColor(0, 0, 0).setFontSize(8).setFont('times', 'italic').setLineWidth(0.2).line(margin, ph - 15, pageWidth - margin, ph - 15);
            doc.text(config.reportFooterNote || "Dokumen otomatis.", margin, ph - 10);
            doc.setFontSize(9).setFont('times', 'normal').text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, ph - 10, { align: 'right' });
        }
        doc.save(`Laporan_${userData.name?.replace(/\s+/g, '_')}_${format(currentMonth, 'MMMM_yyyy')}.pdf`);
    };

    const getStatusColorClass = (status: string, desc: string, hasOut: boolean) => {
        const s = status.toLowerCase();
        if (s === 'alpa') return "bg-red-500 text-white";
        if (s === 'sakit') return "bg-orange-500 text-white";
        if (s.includes('izin') || s.includes('dinas')) return "bg-amber-500 text-white";
        if (s === 'hadir') return hasOut ? "bg-emerald-500 text-white" : "bg-blue-600 text-white";
        return "bg-primary text-white";
    };

    const canGoPrev = currentMonth > new Date(2026, 0, 1);
    const canGoNext = !isSameMonth(currentMonth, new Date());

    return (
        <div className="flex-1 pt-0 pb-24 md:pt-0 md:px-8 md:pb-24">
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

                <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><FileText className="w-24 h-24 text-white" /></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm"><Calendar className="h-6 w-6" /></div>
                                <div className="space-y-0.5">
                                    <h2 className="font-bold text-2xl tracking-tight leading-tight">Riwayat Absensi & Izin</h2>
                                    <p className="text-[11px] font-medium text-white/80 leading-relaxed">Melihat rincian catatan harian personil.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10 shadow-none" onClick={() => router.refresh()}><RefreshCw className={cn("h-4 w-4", isMutating && "animate-spin")} /></Button>
                        </div>
                    </div>

                    <div className="p-0">
                        <div className="p-4 space-y-6">
                            <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border border-muted-foreground/5 p-1">
                                    <div className="flex items-center">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0 shadow-none text-primary hover:bg-white/10" onClick={() => handleMonthChange(-1)} disabled={!canGoPrev}><ChevronLeft className="h-5 w-5 text-primary" /></Button>
                                        <div className="flex items-center gap-1.5 pl-0.5 pr-3 border-r border-muted-foreground/10 mr-1 min-w-max">
                                            <CalendarDays className="h-4 w-4 text-primary/70" />
                                            <div className="flex flex-col min-w-max">
                                                <span className="text-[7px] font-bold uppercase text-muted-foreground/50 tracking-[0.1em] leading-none">Thn ajaran</span>
                                                <span className="text-[10px] font-black text-primary leading-none mt-0.5 whitespace-nowrap">{initialMonthlyConfig?.academicYear || initialSchoolConfig?.academicYear || "-"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-primary tracking-tight text-center capitalize whitespace-nowrap min-w-[120px]">{format(currentMonth, 'MMMM yyyy', { locale: indonesiaLocale })}</span>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shadow-none text-primary hover:bg-white/10" onClick={() => handleMonthChange(1)} disabled={!canGoNext}><ChevronRight className="h-5 w-5 text-primary" /></Button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end"><Button onClick={handleDownloadPdf} className="w-full sm:w-auto font-bold bg-primary text-white hover:bg-primary/90 h-11 rounded-xl text-xs shadow-none active:scale-[0.98] transition-all"><Download className="mr-2 h-4 w-4" />Unduh PDF</Button></div>
                        </div>

                        <div className="overflow-x-auto border-t border-muted-foreground/5">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none h-11">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px] text-muted-foreground uppercase border-none h-11">No</TableHead>
                                        <TableHead className="font-bold text-[10px] text-muted-foreground uppercase border-none h-11">Tanggal</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-muted-foreground uppercase border-none h-11">Masuk</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-muted-foreground uppercase border-none h-11">Pulang</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-muted-foreground uppercase border-none h-11">Poin</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-muted-foreground uppercase border-none h-11">Status</TableHead>
                                        <TableHead className="font-bold text-[10px] text-muted-foreground uppercase border-none h-11">Keterangan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-background">
                                    {reportDetails.length > 0 ? (
                                        reportDetails.map((item, index) => {
                                            const hasIn = !!item.checkInTime;
                                            const hasOut = !!item.checkOutTime;
                                            const isProblematic = item.status === 'Alpa' || !hasIn || !hasOut;
                                            const isManualLate = item.status === 'Terlambat' || item.description === 'Terlambat';
                                            return (
                                                <TableRow key={item.id} className="hover:bg-muted/50 border-muted-foreground/5 transition-all">
                                                    <TableCell className="text-center font-bold text-xs text-muted-foreground">{index + 1}</TableCell>
                                                    <TableCell className="font-bold text-sm whitespace-nowrap">{safeFormat(item.date, 'eeee, dd MMM yyyy')}</TableCell>
                                                    <TableCell className="text-center font-mono text-xs font-bold">{isManualLate && !item.checkInTime ? <span className="text-red-600">-</span> : safeFormat(item.checkInTime, 'HH:mm:ss')}</TableCell>
                                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{safeFormat(item.checkOutTime, 'HH:mm:ss')}</TableCell>
                                                    <TableCell className="text-center"><Badge variant="outline" className="font-black text-[10px] bg-background text-primary border-primary/20">{item.points?.toFixed(2) || "0.00"}</Badge></TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Badge className={cn("px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap border-none shadow-sm", getStatusColorClass(item.status, item.description, !!item.checkOutTime))}>{isManualLate ? 'Hadir' : item.status}</Badge>
                                                            {isProblematic && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-primary/10"><MoreVertical className="h-4 w-4 text-primary" /></Button></DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-2xl border-none p-2 animate-in zoom-in-95 duration-200">
                                                                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Koreksi Cepat</DropdownMenuLabel>
                                                                        {hasIn && !hasOut ? (
                                                                            <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'lengkapi-pulang')}>Lengkapi absen pulang</DropdownMenuItem>
                                                                        ) : !hasIn && hasOut ? (
                                                                            <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'lengkapi-masuk')}>Lengkapi absen masuk</DropdownMenuItem>
                                                                        ) : (
                                                                            <>
                                                                                <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'hadir')}>Jadikan Hadir (Penuh)</DropdownMenuItem>
                                                                                <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'terlambat')}>Jadikan Terlambat</DropdownMenuItem>
                                                                            </>
                                                                        )}
                                                                        <DropdownMenuSeparator className='my-1.5 opacity-50' />
                                                                        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-1">Ketidakhadiran</DropdownMenuLabel>
                                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'sakit')}>Jadikan Sakit</DropdownMenuItem>
                                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'izin')}>Jadikan Izin Pribadi</DropdownMenuItem>
                                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'dinas-pagi')}>Dinas Pagi</DropdownMenuItem>
                                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'dinas-siang')}>Dinas Siang</DropdownMenuItem>
                                                                        <DropdownMenuItem className="rounded-xl py-2.5 px-3 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'pulang-cepat')}>Pulang Cepat</DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-[10px] font-medium italic opacity-70 whitespace-nowrap">{item.description}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow><TableCell colSpan={7} className="h-48 text-center font-bold text-muted-foreground opacity-40 uppercase text-[10px] tracking-widest">Tidak ada data.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="p-6 border-t border-muted-foreground/10 space-y-6 bg-muted/5">
                            <div className="bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-primary/10 overflow-hidden shadow-sm max-w-2xl mx-auto">
                                <div className="grid grid-cols-2">
                                    <div className="p-5 flex flex-col items-center justify-center text-center border-r border-primary/5">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] mb-2 leading-none">Total Akumulasi Poin</p>
                                        <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary opacity-30 shrink-0" /><span className="text-3xl font-black text-primary mt-1.5 tabular-nums leading-none">{stats.totalPoints}</span></div>
                                    </div>
                                    <div className="p-5 flex flex-col items-center justify-center text-center">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] mb-2 leading-none">Persentase Kehadiran</p>
                                        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600 opacity-30 shrink-0" /><span className="text-3xl font-black text-green-600 mt-1.5 tabular-nums leading-none">{stats.persentase}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1"><Info className="h-3 w-3 text-muted-foreground" /><h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Informasi Skema Poin</h3></div>
                                <PointLegend />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

