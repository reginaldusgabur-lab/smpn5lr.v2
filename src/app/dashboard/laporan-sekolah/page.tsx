'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { format, isBefore, isSameDay, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths, startOfDay, setHours, setMinutes, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ChevronLeft, ChevronRight, Search, Download, Eye, CalendarDays, RefreshCw, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculatePoints } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import { invalidateCache } from '@/lib/cache';

interface ReportRowData {
    no: number;
    uid: string;
    name: string;
    nip: string;
    position: string;
    role: string;
    totalHadir: number;
    totalIzin: number;
    totalSakit: number;
    totalAlpa: number;
    persentase: string;
    sequenceNumber: number | null;
    status: string;
}

const minDate = new Date(2026, 0, 1);

export default function SchoolReportPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [reportData, setReportData] = useState<ReportRowData[]>([]);
    const [isReportLoading, setIsReportLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [academicYear, setAcademicYear] = useState("");
    const [monthlyConfig, setMonthlyConfig] = useState<any>(null);
    const isMounted = useRef(true);

    const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
    const { data: schoolConfigData } = useDoc(user, schoolConfigRef);

    useEffect(() => {
        if (schoolConfigData?.academicYear && !academicYear) {
            setAcademicYear(schoolConfigData.academicYear);
        }
    }, [schoolConfigData, academicYear]);

    const loadData = useCallback(async () => {
        if (!firestore || !user?.uid || !isMounted.current || !schoolConfigData) return;
        setIsReportLoading(true);
        setError(null);
        try {
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);
            const today = startOfDay(new Date());
            const todayStr = format(today, 'yyyy-MM-dd');
            const monthlyConfigRef = doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'));
            
            const usersQuery = query(collection(firestore, 'users'), where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']), where('status', 'in', ['Aktif', 'Cuti']));
            const [usersSnap, monthlySnap] = await Promise.all([getDocs(usersQuery), getDoc(monthlyConfigRef)]);

            const mConfig = monthlySnap.exists() ? monthlySnap.data() : {};
            if (isMounted.current) {
                setMonthlyConfig(mConfig);
                setAcademicYear(mConfig.academicYear || schoolConfigData.academicYear || "");
            }
            
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const qAtt = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '>=', format(start, 'yyyy-MM-dd')), where('date', '<=', format(end, 'yyyy-MM-dd')));
            const qLeave = query(collectionGroup(firestore, 'leaveRequests'), where('status', '==', 'approved'));
            const [attSnap, leaveSnap] = await Promise.all([getDocs(qAtt), getDocs(qLeave)]);

            const attByUser: Record<string, any[]> = {};
            attSnap.docs.forEach(d => {
                const uid = d.data().userId || d.ref.parent.parent?.id;
                if (uid) (attByUser[uid] = attByUser[uid] || []).push(d.data());
            });

            const leaveByUser: Record<string, any[]> = {};
            leaveSnap.docs.forEach(d => {
                const uid = d.data().userId || d.ref.parent.parent?.id;
                if (uid) (leaveByUser[uid] = leaveByUser[uid] || []).push(d.data());
            });

            const offDays: number[] = (schoolConfigData as any)?.offDays ?? [0, 6];
            const holidays: string[] = (mConfig as any)?.holidays ?? [];
            const workingDays = eachDayOfInterval({ start, end }).filter(day => !offDays.includes(day.getDay()) && !holidays.includes(format(day, 'yyyy-MM-dd')));
            const workingDaysSet = new Set(workingDays.map(day => format(day, 'yyyy-MM-dd')));

            const results = allUsers.map(u => {
                let points = 0; let hadirCount = 0; let izinCount = 0; let sakitCount = 0;
                const processed = new Set<string>();

                (attByUser[u.id] || []).forEach(att => {
                    const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
                    if (dStr && workingDaysSet.has(dStr) && !processed.has(dStr)) {
                        const desc = (att.reasonForUpdate || '').toLowerCase();
                        points += calculatePoints('hadir', desc, !!att.checkInTime, !!att.checkOutTime, dStr === todayStr);
                        if (desc.includes('luar sekolah')) izinCount++; else hadirCount++;
                        processed.add(dStr);
                    }
                });

                (leaveByUser[u.id] || []).forEach(leave => {
                    const lS = leave.startDate.toDate(); const lE = leave.endDate.toDate();
                    eachDayOfInterval({ start: lS, end: lE }).forEach(day => {
                        const dStr = format(day, 'yyyy-MM-dd');
                        if (workingDaysSet.has(dStr) && !processed.has(dStr)) {
                            const type = (leave.type || '').toLowerCase();
                            points += calculatePoints(leave.type, leave.reason || leave.type, false, false, false);
                            if (type.includes('sakit')) sakitCount++; else izinCount++;
                            processed.add(dStr);
                        }
                    });
                });

                const totalAlpa = workingDays.filter(day => format(day, 'yyyy-MM-dd') <= todayStr && !processed.has(format(day, 'yyyy-MM-dd'))).length;
                const persentase = u.status === 'Cuti' ? '-' : (Math.min((points / Math.max(1, workingDays.length)) * 100, 100).toFixed(1) + '%');

                return {
                    uid: u.id, name: u.name, nip: u.nip || '-', position: u.position || '-', role: u.role || '',
                    sequenceNumber: u.sequenceNumber || null, totalHadir: hadirCount, totalIzin: izinCount, totalSakit: sakitCount, totalAlpa, 
                    persentase, status: u.status
                };
            });

            if (isMounted.current) {
                setReportData(results.sort((a, b) => (a.sequenceNumber ?? 999) - (b.sequenceNumber ?? 999)).map((r, i) => ({ ...r, no: i + 1 })));
                setIsReportLoading(false);
            }
        } catch (err) { if (isMounted.current) setIsReportLoading(false); }
    }, [firestore, user?.uid, currentMonth, schoolConfigData]);

    useEffect(() => {
        isMounted.current = true;
        if (!isUserLoading && user?.uid && schoolConfigData) loadData();
        return () => { isMounted.current = false; };
    }, [loadData, user?.uid, isUserLoading, schoolConfigData]);

    const filteredReports = useMemo(() => reportData.filter(r => (roleFilter === 'all' || r.role === roleFilter) && r.name.toLowerCase().includes(searchTerm.toLowerCase())), [reportData, roleFilter, searchTerm]);

    const handleMonthChange = (amount: number) => {
        const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 15);
        if (next >= minDate && next <= new Date()) setCurrentMonth(next);
    };

    const canGoPrev = currentMonth > minDate;
    const canGoNext = !isSameMonth(currentMonth, new Date());

    const handleDownloadPdf = async () => {
        if (!filteredReports.length || isExporting) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 14;
            const config = schoolConfigData || ({} as any);
            const mConfig = monthlyConfig || {};

            doc.setFont('times', 'bold').setFontSize(14).text((config.governmentAgency || 'PEMERINTAH KABUPATEN MANGGARAI').toUpperCase(), pageWidth/2, 15, { align: 'center' });
            doc.text((config.educationAgency || 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA').toUpperCase(), pageWidth/2, 21, { align: 'center' });
            doc.setFontSize(12).text((config.schoolName || 'SMP NEGERI 5 LANGKE REMBONG').toUpperCase(), pageWidth/2, 28, { align: 'center' });
            doc.setFont('times', 'normal').setFontSize(9).text(`Alamat: ${config.address || 'Alamat Sekolah'}`, pageWidth/2, 34, { align: 'center' });
            doc.setLineWidth(0.8).line(margin, 38, pageWidth - margin, 38);

            doc.setFont('times', 'bold').setFontSize(12).text('LAPORAN KEHADIRAN GURU/TENDIK', pageWidth/2, 48, { align: 'center' });
            doc.text(`Bulan ${format(currentMonth, 'MMMM yyyy', { locale: id })}`, pageWidth/2, 54, { align: 'center' });
            doc.setFontSize(10).setFont('times', 'normal').text(`Tahun Ajaran: ${academicYear || config.academicYear || '-'}`, pageWidth/2, 60, { align: 'center' });

            const tableRows = filteredReports.map((item, i) => [item.sequenceNumber || i + 1, item.name, item.nip, item.position.replace('PPPK Paruh Waktu (PW)', 'PPPK PW'), Math.ceil(item.totalHadir), item.totalIzin, item.totalSakit, item.totalAlpa, item.status === 'Cuti' ? '-' : item.persentase]);

            autoTable(doc, {
                startY: 68,
                head: [['No', 'Nama', 'NIP', 'Status', 'Hadir', 'Izin', 'Sakit', 'Alpa', '%']],
                body: tableRows,
                theme: 'striped',
                margin: { bottom: 65 },
                styles: { font: 'times', fontSize: 10, cellPadding: 1 },
                headStyles: { fillColor: [52, 152, 219], halign: 'center' },
                columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 8: { halign: 'right', cellWidth: 15 } }
            });

            const currentTableEndY = (doc as any).lastAutoTable.finalY;
            const signatureX = pageWidth - 85;
            doc.text(`${config.reportCity || 'Mando'}, ${format(new Date(), 'd MMMM yyyy', { locale: id })}`, signatureX, currentTableEndY + 15);
            doc.text('Mengetahui, Kepala Sekolah', signatureX, currentTableEndY + 21);
            doc.setFont('times', 'bold').text(config.headmasterName || 'Lodovikus Jangkar, S.Pd.Gr', signatureX, currentTableEndY + 45);
            doc.setFont('times', 'normal').text(`NIP. ${config.headmasterNip || '-'}`, signatureX, currentTableEndY + 51);

            doc.save(`Laporan_Sekolah_${format(currentMonth, 'MMMM_yyyy', { locale: id })}.pdf`);
        } finally { setIsExporting(false); }
    };

    return (
        <div className="flex-1 pt-2 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <Card className="overflow-hidden border border-muted-foreground/10 shadow-md rounded-xl bg-card">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl shadow-sm"><FileText className="h-6 w-6" /></div>
                            <div className="space-y-0.5"><h2 className="font-bold text-2xl tracking-tight">Laporan sekolah</h2><p className="text-[11px] font-medium text-white/80">Rekapitulasi kehadiran seluruh personil.</p></div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => { invalidateCache(); loadData(); }} disabled={isReportLoading}><RefreshCw className={cn("h-4 w-4", isReportLoading && "animate-spin")} /></Button>
                    </div>
                    <CardContent className="p-4 space-y-6">
                        <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border p-1">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleMonthChange(-1)} disabled={isReportLoading || !canGoPrev}><ChevronLeft className="h-5 w-5 text-primary" /></Button>
                            <span className="font-bold text-sm text-primary capitalize text-center">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleMonthChange(1)} disabled={isReportLoading || !canGoNext}><ChevronRight className="h-5 w-5 text-primary" /></Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua peran</SelectItem><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem></SelectContent></Select>
                            <Input placeholder="Cari nama..." className="md:col-span-2 h-11 rounded-xl bg-background" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Button className="w-full font-bold h-12 rounded-xl" disabled={isReportLoading || !filteredReports.length || isExporting} onClick={handleDownloadPdf}>{isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}UNDUH PDF</Button>
                        <div className="overflow-x-auto border rounded-xl">
                            <Table>
                                <TableHeader className="bg-muted/30"><TableRow><TableHead className="w-[60px] text-center text-xs">No</TableHead><TableHead className="text-xs">Nama & Nip</TableHead><TableHead className="text-center text-xs">Hadir</TableHead><TableHead className="text-center text-xs">Izin</TableHead><TableHead className="text-center text-xs">Sakit</TableHead><TableHead className="text-center text-xs">Alpa</TableHead><TableHead className="text-center text-xs">%</TableHead><TableHead className="w-[80px] text-center text-xs">Aksi</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {isReportLoading ? [...Array(6)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)) : filteredReports.length > 0 ? filteredReports.map((item) => (
                                            <TableRow key={item.uid} className="hover:bg-primary/5">
                                                <TableCell className="text-center font-bold text-sm">{item.no}</TableCell>
                                                <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{item.name}</span><span className="text-[10px]">{item.nip}</span></div></TableCell>
                                                <TableCell className="text-center font-black text-green-600">{Math.ceil(item.totalHadir)}</TableCell>
                                                <TableCell className="text-center font-black text-blue-500">{item.totalIzin}</TableCell>
                                                <TableCell className="text-center font-black text-orange-500">{item.totalSakit}</TableCell>
                                                <TableCell className="text-center font-black text-red-500">{item.totalAlpa}</TableCell>
                                                <TableCell className="text-center font-black text-primary">{item.persentase}</TableCell>
                                                <TableCell className="text-center"><Link href={`/dashboard/laporan/${item.uid}?month=${format(currentMonth, 'yyyy-MM')}`}><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Eye className="h-4 w-4 text-primary" /></Button></Link></TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground font-bold">Data tidak ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
