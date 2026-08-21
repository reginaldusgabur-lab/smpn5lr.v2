'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, startOfMonth, parseISO, isValid, endOfMonth, endOfDay, startOfDay, addMonths, subMonths, isSameMonth, addMinutes, setHours, setMinutes } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { doc, writeBatch, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight, CheckCircle2, XCircle, FileWarning, CalendarClock, MoreVertical, RefreshCw, Calendar, FileText, CalendarDays, ArrowLeft, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invalidateCache } from '@/lib/cache';

interface ReportDetail {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  description: string;
}

interface UserData { name?: string; role?: string; nip?: string; position?: string; }
interface ClientShellProps {
  userId: string;
  initialUserData: UserData;
  initialReportData: ReportDetail[];
  initialMonth: string;
  initialSchoolConfig: any;
}

export default function ReportClientShell({ 
    userId, 
    initialUserData,
    initialReportData,
    initialMonth,
    initialSchoolConfig
}: ClientShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();

    const [userData] = useState<UserData>(initialUserData);
    const [reportDetails, setReportDetails] = useState<ReportDetail[]>(initialReportData || []);
    const [isMutating, setIsMutating] = useState(false);

    const parsedInitialMonth = parseISO(initialMonth);
    const [currentMonth, setCurrentMonth] = useState(isValid(parsedInitialMonth) ? parsedInitialMonth : new Date());

    const summaryStats = useMemo(() => {
        const hadir = reportDetails.filter(d => d.status === 'Hadir' || d.status === 'Terlambat' || d.status === 'Pulang').length;
        const sakit = reportDetails.filter(d => d.status === 'Sakit').length;
        const izin = reportDetails.filter(d => d.status === 'Izin' || d.status === 'Dinas').length;
        const alpa = reportDetails.filter(d => d.status === 'Alpa').length;
        return { hadir, sakit, izin, alpa };
    }, [reportDetails]);

    const chartData = [
        { name: 'Hadir', Jumlah: summaryStats.hadir, fill: '#22c55e' },
        { name: 'Sakit', Jumlah: summaryStats.sakit, fill: '#f97316' },
        { name: 'Izin', Jumlah: summaryStats.izin, fill: '#f59e0b' },
        { name: 'Alpa', Jumlah: summaryStats.alpa, fill: '#ef4444' },
    ];

    const handleMonthChange = (amount: number) => {
        const newMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 15);
        router.push(`${pathname}?month=${format(newMonthDate, 'yyyy-MM')}`);
    };
    
    const safeFormat = (date: string | Date | null, formatString: string): string => {
        if (!date) return '-';
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return isValid(dateObj) ? format(dateObj, formatString, { locale: indonesiaLocale }) : '-';
    }

    const handleStatusChange = async (dateStr: string, newStatus: string, reason: string) => {
        if (!authUser || !firestore || isMutating) return;
        setIsMutating(true);
        try {
            const targetDate = parseISO(dateStr);
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

            const newLeaveDoc = doc(leaveRef);
            batch.set(newLeaveDoc, {
                id: newLeaveDoc.id,
                userId, userName: userData.name, userRole: userData.role,
                type: newStatus === 'Sakit' ? 'Sakit' : 'Izin',
                status: 'approved', reason,
                startDate: Timestamp.fromDate(startOfDay(targetDate)),
                endDate: Timestamp.fromDate(endOfDay(targetDate)),
                createdAt: serverTimestamp(), approvedBy: authUser.uid, approvedAt: serverTimestamp()
            });

            await batch.commit();
            invalidateCache();
            toast({ title: 'Berhasil', description: `Status diperbarui menjadi ${reason}.` });
            router.refresh();
        } catch (err) { toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan sistem.' }); }
        finally { setIsMutating(false); }
    };

    const handleDownloadPdf = () => {
        if (!userData || reportDetails.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        const margin = 14;
        const config = initialSchoolConfig || ({} as any);

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
        doc.text(`Bulan ${format(currentMonth, 'MMMM yyyy', { locale: indonesiaLocale })}`, centerX, 54, { align: 'center' });
        doc.setFontSize(10).setFont('times', 'normal');
        doc.text(`Tahun Ajaran: ${config.academicYear || '-'}`, centerX, 60, { align: 'center' });

        let currentY = 70;
        doc.setFontSize(11).setFont('times', 'normal');
        doc.text(`Nama : ${userData.name}`, margin, currentY); currentY += 6;
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
            styles: { font: 'times', fontSize: 10, cellPadding: 2 },
            headStyles: { fillColor: [52, 152, 219], textColor: 255, halign: 'center' },
            columnStyles: { 0: { halign: 'center', cellWidth: 10 } }
        });

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

                <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-2xl p-0">
                    {/* Header Card - Biru Gradasi */}
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12">
                            <FileText className="w-24 h-24 text-white" />
                        </div>
                        
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm">
                                    <Calendar className="h-6 w-6" />
                                </div>
                                <div className="space-y-0.5">
                                    <h2 className="font-bold text-2xl tracking-tight leading-tight">Riwayat Absensi & Izin</h2>
                                    <p className="text-[11px] font-medium text-white/80 leading-relaxed">Melihat rincian catatan harian personil.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10 shadow-none" onClick={() => router.refresh()}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="p-0 bg-blue-600">
                        <div className="p-4 space-y-6 bg-blue-600">
                            <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center justify-between w-full bg-white/10 rounded-2xl border border-white/10 p-1">
                                    <div className="flex items-center">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl shrink-0 shadow-none text-white hover:bg-white/10" 
                                            onClick={() => handleMonthChange(-1)} 
                                            disabled={!canGoPrev}
                                        >
                                            <ChevronLeft className="h-5 w-5 text-white" />
                                        </Button>
                                        <div className="flex items-center gap-1.5 pl-0.5 pr-3 border-r border-white/20 mr-1.5 min-w-max">
                                            <CalendarDays className="h-4 w-4 text-white/70" />
                                            <div className="flex flex-col min-w-max">
                                                <span className="text-[7px] font-bold uppercase text-white/50 tracking-[0.1em] leading-none">Thn ajaran</span>
                                                <span className="text-[10px] font-black text-white leading-none mt-0.5 whitespace-nowrap">{initialSchoolConfig?.academicYear || "-"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-white tracking-tight text-center capitalize whitespace-nowrap min-w-[120px]">
                                            {format(currentMonth, 'MMMM yyyy', { locale: indonesiaLocale })}
                                        </span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl shadow-none text-white hover:bg-white/10" 
                                            onClick={() => handleMonthChange(1)} 
                                            disabled={!canGoNext}
                                        >
                                            <ChevronRight className="h-5 w-5 text-white" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleDownloadPdf} className="w-full sm:w-auto font-bold bg-white text-blue-600 hover:bg-white/90 h-11 rounded-xl text-xs shadow-none active:scale-[0.98] transition-all">
                                    <Download className="mr-2 h-4 w-4" />Unduh PDF
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-blue-600">
                                    <TableRow className="border-none h-11">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px] text-white border-none h-11">No</TableHead>
                                        <TableHead className="font-bold text-[10px] text-white border-none h-11">Tanggal</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-white border-none h-11">Masuk</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-white border-none h-11">Pulang</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-white border-none h-11">Status</TableHead>
                                        <TableHead className="font-bold text-[10px] text-white border-none h-11">Keterangan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-background">
                                    {reportDetails.length > 0 ? (
                                        reportDetails.map((item, index) => {
                                            const isManualLate = item.status === 'Terlambat' || item.description === 'Terlambat';
                                            return (
                                                <TableRow key={item.id} className="hover:bg-muted/50 border-muted-foreground/5">
                                                    <TableCell className="text-center font-bold text-xs text-muted-foreground">{index + 1}</TableCell>
                                                    <TableCell className="font-bold text-sm whitespace-nowrap">{safeFormat(item.date, 'eeee, dd MMM yyyy')}</TableCell>
                                                    <TableCell className="text-center font-mono text-xs font-bold">
                                                        {isManualLate && !item.checkInTime ? <span className="text-red-600">-</span> : safeFormat(item.checkInTime, 'HH:mm:ss')}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">{safeFormat(item.checkOutTime, 'HH:mm:ss')}</TableCell>
                                                    <TableCell className="text-center">
                                                        <span className={cn("inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap", getStatusColorClass(item.status, item.description, !!item.checkOutTime))}>
                                                            {isManualLate ? 'Hadir' : item.status}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-[10px] font-medium italic opacity-70">{item.description}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-48 text-center font-bold text-muted-foreground opacity-40 uppercase text-[10px] tracking-widest">Tidak ada data.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

