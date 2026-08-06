
'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { format, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths, startOfDay, isBefore, isSameDay, eachDayOfInterval, setHours, setMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ChevronLeft, ChevronRight, Search, Download, Eye, CalendarDays, PieChart as PieIcon, Award, AlertCircle, Thermometer } from 'lucide-react';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

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
    persentaseNum: number;
    sequenceNumber: number | null;
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
    const isMounted = useRef(true);

    const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
    const { data: schoolConfigData } = useDoc(user, schoolConfigRef);

    const loadData = useCallback(async () => {
        if (!firestore || !user?.uid || !isMounted.current || !schoolConfigData) return;
        
        setIsReportLoading(true);
        setError(null);
        
        try {
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);
            const monthId = format(currentMonth, 'yyyy-MM');

            const monthlyConfigRef = doc(firestore, 'monthlyConfigs', monthId);
            const usersQuery = query(
                collection(firestore, 'users'), 
                where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']),
                where('status', '==', 'Aktif')
            );
            
            const [monthlySnap, usersSnap] = await Promise.all([
                getDoc(monthlyConfigRef),
                getDocs(usersQuery)
            ]);

            const monthlyConfig = monthlySnap.exists() ? monthlySnap.data() : {};
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (isMounted.current) {
                setAcademicYear(monthlyConfig.academicYear || schoolConfigData.academicYear || "");
            }

            const attendanceQuery = query(collectionGroup(firestore, 'attendanceRecords'), where('checkInTime', '>=', start), where('checkInTime', '<=', end));
            const attendanceFallbackQuery = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '>=', format(start, 'yyyy-MM-dd')), where('date', '<=', format(end, 'yyyy-MM-dd')));
            const leaveQuery = query(collectionGroup(firestore, 'leaveRequests'), where('status', '==', 'approved'));

            const [attSnap, attFallbackSnap, leaveSnap] = await Promise.all([
                getDocs(attendanceQuery), 
                getDocs(attendanceFallbackSnap), 
                getDocs(leaveQuery)
            ]);

            const attendanceByUserId: Record<string, any[]> = {};
            [...attSnap.docs, ...attFallbackSnap.docs].forEach(d => {
                const data = d.data();
                const uid = data.userId || d.ref.parent.parent?.id;
                if (uid) {
                    const existing = attendanceByUserId[uid] || [];
                    const dStr = data.date || (data.checkInTime ? format(data.checkInTime.toDate(), 'yyyy-MM-dd') : null);
                    if (dStr && !existing.some(e => (e.date || (e.checkInTime ? format(e.checkInTime.toDate(), 'yyyy-MM-dd') : '')) === dStr)) {
                        attendanceByUserId[uid] = [...existing, data];
                    }
                }
            });

            const leaveByUserId: Record<string, any[]> = {};
            leaveSnap.docs.forEach(d => {
                const data = d.data();
                const uid = data.userId || d.ref.parent.parent?.id;
                if (uid) (leaveByUserId[uid] = leaveByUserId[uid] || []).push(data);
            });

            const offDays: number[] = (schoolConfigData as any)?.offDays ?? [0, 6];
            const holidays: string[] = (monthlyConfig as any)?.holidays ?? [];
            const workingDays = eachDayOfInterval({ start, end }).filter(day => !offDays.includes(day.getDay()) && !holidays.includes(format(day, 'yyyy-MM-dd')));
            const workingDaysSet = new Set(workingDays.map(day => format(day, 'yyyy-MM-dd')));
            const today = startOfDay(new Date());
            const pastWorkingDays = workingDays.filter(day => isBefore(day, today) || isSameDay(day, today));

            const results = allUsers.map(u => {
                let points = 0;
                let hadirCount = 0;
                let izinCount = 0;
                let sakitCount = 0;
                const processedDates = new Set<string>();

                (attendanceByUserId[u.id] || []).forEach(att => {
                    const attDateStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : '');
                    if (attDateStr && workingDaysSet.has(attDateStr) && !processedDates.has(attDateStr)) {
                        let p = 0;
                        const desc = (att.reasonForUpdate || '').toLowerCase();
                        if (desc.includes('dinas') || desc.includes('kehadiran penuh') || desc.includes('kegiatan luar sekolah')) p = 1.0;
                        else if (att.checkInTime && att.checkOutTime) {
                            let isLate = false;
                            const checkInDate = att.checkInTime.toDate();
                            if (schoolConfigData.useTimeValidation && (schoolConfigData as any).checkInEndTime) {
                                const [h, m] = (schoolConfigData as any).checkInEndTime.split(':').map(Number);
                                const deadline = setMinutes(setHours(startOfDay(checkInDate), h), m);
                                if (checkInDate > deadline) isLate = true;
                            }
                            p = isLate ? 0.95 : 1.0;
                        } else p = 0.5;
                        points += p; hadirCount++; processedDates.add(attDateStr);
                    }
                });

                (leaveByUserId[u.id] || []).forEach(leave => {
                    eachDayOfInterval({ start: leave.startDate.toDate(), end: leave.endDate.toDate() }).forEach(day => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        if (workingDaysSet.has(dayStr) && !processedDates.has(dayStr)) {
                            let p = 0;
                            if (leave.type === 'Sakit') { p = 0.9; sakitCount++; }
                            else if (leave.type === 'Izin' || leave.type === 'Izin Pribadi') { p = 0.7; izinCount++; }
                            else { p = 1.0; hadirCount++; }
                            points += p; processedDates.add(dayStr);
                        }
                    });
                });

                const totalAlpa = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;
                const persentaseNum = Math.min((points / (workingDays.length || 1)) * 100, 100);
                const persentase = persentaseNum.toFixed(1) + '%';

                return {
                    uid: u.id, name: (u as any).name || '', nip: (u as any).nip || '-',
                    position: (u as any).position || '-', role: (u as any).role || '',
                    sequenceNumber: (u as any).sequenceNumber || null,
                    totalHadir: hadirCount, totalIzin: izinCount, totalSakit: sakitCount, totalAlpa, 
                    persentaseNum, persentase
                };
            });

            results.sort((a, b) => (a.sequenceNumber ?? 999) - (b.sequenceNumber ?? 999));
            if (isMounted.current) {
                setReportData(results.map((r, i) => ({ ...r, no: i + 1 })));
                setIsReportLoading(false);
            }
        } catch (err) { 
            console.error("Error loading report data:", err);
            if (isMounted.current) { setIsReportLoading(false); setError("Gagal memuat data."); }
        }
    }, [firestore, user?.uid, currentMonth, schoolConfigData]);

    useEffect(() => {
        isMounted.current = true;
        if (!isUserLoading && user?.uid && schoolConfigData) loadData();
        return () => { isMounted.current = false; };
    }, [loadData, user?.uid, isUserLoading, schoolConfigData]);

    const filteredReports = useMemo(() => reportData.filter(r => (roleFilter === 'all' || r.role === roleFilter) && r.name.toLowerCase().includes(searchTerm.toLowerCase())), [reportData, roleFilter, searchTerm]);

    const statsData = useMemo(() => {
        const totals = filteredReports.reduce((acc, curr) => {
            acc.hadir += curr.totalHadir;
            acc.izin += curr.totalIzin;
            acc.sakit += curr.totalSakit;
            acc.alpa += curr.totalAlpa;
            return acc;
        }, { hadir: 0, izin: 0, sakit: 0, alpa: 0 });

        const pie = [
            { name: 'Hadir', value: Math.round(totals.hadir), color: '#22c55e' },
            { name: 'Izin', value: totals.izin, color: '#3b82f6' },
            { name: 'Sakit', value: totals.sakit, color: '#f97316' },
            { name: 'Alpa', value: totals.alpa, color: '#ef4444' },
        ];

        const topRajin = [...filteredReports].sort((a, b) => b.persentaseNum - a.persentaseNum).slice(0, 3);
        const topSakit = [...filteredReports].sort((a, b) => b.totalSakit - a.totalSakit).slice(0, 3);
        const topAlpa = [...filteredReports].sort((a, b) => b.totalAlpa - a.totalAlpa).slice(0, 3);

        return { pie, topRajin, topSakit, topAlpa };
    }, [filteredReports]);

    const handleDownloadPdf = async () => {
        if (!filteredReports.length || isExporting) return;
        setIsExporting(true);
        try {
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

            const tableRows = filteredReports.map((item, index) => [item.sequenceNumber || index + 1, item.name, item.nip, (item.position || '-').replace('PPPK Paruh Waktu (PW)', 'PPPK PW'), Math.ceil(item.totalHadir), item.totalIzin, item.totalSakit, item.totalAlpa, item.persentase]);
            autoTable(doc, {
                startY: 68,
                head: [['No', 'Nama', 'NIP', 'Status', 'Hadir', 'Izin', 'Sakit', 'Alpa', '%']],
                body: tableRows,
                theme: 'striped',
                margin: { bottom: 35 },
                styles: { font: 'times', fontSize: 10, cellPadding: 1.5, valign: 'middle', textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.1 },
                headStyles: { fillColor: [52, 152, 219], textColor: 255, halign: 'center', fontStyle: 'bold', minCellHeight: 12 },
                columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 }, 3: { halign: 'center', cellWidth: 18 }, 4: { halign: 'center', cellWidth: 15 }, 5: { halign: 'center', cellWidth: 12 }, 6: { halign: 'center', cellWidth: 15 }, 7: { halign: 'center', cellWidth: 12 }, 8: { halign: 'right', cellWidth: 13 } }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 15;
            const sigX = pageWidth - 85;
            doc.text(`${config.reportCity || 'Mando'}, ${format(new Date(), 'd MMMM yyyy', { locale: id })}`, sigX, finalY);
            doc.text('Kepala Sekolah', sigX, finalY + 12);
            doc.setFont('times', 'bold').text(config.headmasterName || 'Lodovikus Jangkar, S.Pd.Gr', sigX, finalY + 38);
            doc.setFont('times', 'normal').text(`NIP. ${config.headmasterNip || '-'}`, sigX, finalY + 44);

            doc.save(`Laporan_Sekolah_${format(currentMonth, 'MMMM_yyyy', { locale: id })}.pdf`);
        } finally { setIsExporting(false); }
    };

    return (
        <div className="flex-1 pt-2 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="px-4 md:px-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-normal tracking-tight">Laporan sekolah</h1>
                        <p className="text-sm text-muted-foreground">Rekapitulasi kehadiran seluruh personil.</p>
                    </div>
                </div>

                <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl bg-card">
                    <CardContent className="p-0 min-h-[500px]">
                        <div className="p-4 space-y-6">
                            <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border border-muted-foreground/5 p-1">
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} disabled={isReportLoading || currentMonth < minDate}><ChevronLeft className="h-5 w-5 text-primary" /></Button>
                                    <div className="flex items-center gap-1.5 px-1 min-w-max">
                                        <CalendarDays className="h-4 w-4 text-primary/70" />
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-black uppercase text-muted-foreground/60 leading-none">THN AJARAN</span>
                                            <span className="text-[10px] font-black text-primary leading-none mt-0.5">{academicYear || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-primary capitalize">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={isReportLoading || isSameMonth(currentMonth, new Date())}><ChevronRight className="h-5 w-5 text-primary" /></Button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/20 p-4 rounded-2xl border border-muted-foreground/5">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Peran</Label>
                                    <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="h-11 rounded-xl bg-background font-bold text-xs shadow-none border-muted-foreground/10"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-none shadow-2xl"><SelectItem value="all">Semua peran</SelectItem><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem></SelectContent></Select>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cari Nama</Label>
                                    <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" /><Input placeholder="Nama personil..." className="pl-11 h-11 rounded-xl bg-background border-muted-foreground/10 font-bold text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button className="w-full sm:w-auto h-11 px-8 rounded-xl font-bold bg-primary" disabled={isReportLoading || !filteredReports.length || isExporting} onClick={handleDownloadPdf}>
                                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}UNDUH PDF
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-muted-foreground/10 overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase">No</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Nama & NIP</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase">Hadir</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase">Izin</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase">Sakit</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase">Alpa</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase">%</TableHead>
                                        <TableHead className="w-[80px] text-center font-bold text-[10px] uppercase">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isReportLoading ? [...Array(6)].map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : filteredReports.length > 0 ? filteredReports.map((item) => (
                                        <TableRow key={item.uid} className="hover:bg-primary/5">
                                            <TableCell className="text-center font-bold text-muted-foreground text-sm">{item.no}</TableCell>
                                            <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{item.name}</span><span className="text-[10px] font-bold text-muted-foreground">{item.nip}</span></div></TableCell>
                                            <TableCell className="text-center font-bold text-green-600/80">{Math.ceil(item.totalHadir)}</TableCell>
                                            <TableCell className="text-center font-bold text-blue-500/80">{item.totalIzin}</TableCell>
                                            <TableCell className="text-center font-bold text-orange-500/80">{item.totalSakit}</TableCell>
                                            <TableCell className="text-center font-bold text-destructive/80">{item.totalAlpa}</TableCell>
                                            <TableCell className="text-center font-bold text-primary/80">{item.persentase}</TableCell>
                                            <TableCell className="text-center"><Link href={`/dashboard/laporan/${item.uid}?month=${format(currentMonth, 'yyyy-MM')}`}><Button variant="ghost" size="icon" className="rounded-full"><Eye className="h-5 w-5 text-primary" /></Button></Link></TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-48 text-center font-bold opacity-50 uppercase text-xs">Data tidak ditemukan</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {!isReportLoading && filteredReports.length > 0 && (
                    <Card className="border border-muted-foreground/10 shadow-none rounded-xl overflow-hidden bg-card">
                        <CardHeader className="p-6 border-b border-muted-foreground/5">
                            <div className="flex items-center gap-3">
                                <PieIcon className="h-5 w-5 text-primary" />
                                <div><CardTitle className="text-lg font-bold">Statistik Kehadiran</CardTitle><CardDescription className="text-xs font-medium">Rekapitulasi performa bulan ini.</CardDescription></div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={statsData.pie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{statsData.pie.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie>
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} formatter={(v) => [`${v} hari`, 'Jumlah']} />
                                            <Legend verticalAlign="bottom" height={36} formatter={(v) => <span className="text-[11px] font-medium text-muted-foreground">{v}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl flex items-start gap-4">
                                        <Award className="h-6 w-6 text-green-600 mt-1" />
                                        <div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-green-600/60">Paling rajin (Top 3)</p><div className="mt-2 space-y-1.5">{statsData.topRajin.map((u, idx) => u.persentaseNum > 0 && <div key={u.uid} className="flex justify-between items-center"><span className="font-bold text-sm truncate max-w-[180px]">{idx + 1}. {u.name}</span><span className="text-[10px] font-black text-green-600">{u.persentase}</span></div>)}</div></div>
                                    </div>
                                    <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-start gap-4">
                                        <Thermometer className="h-6 w-6 text-orange-600 mt-1" />
                                        <div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-orange-600/60">Sering sakit (Top 3)</p><div className="mt-2 space-y-1.5">{statsData.topSakit.map((u, idx) => u.totalSakit > 0 && <div key={u.uid} className="flex justify-between items-center"><span className="font-bold text-sm truncate max-w-[180px]">{idx + 1}. {u.name}</span><span className="text-[10px] font-black text-orange-600">{u.totalSakit} hari</span></div>)}</div></div>
                                    </div>
                                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-4">
                                        <AlertCircle className="h-6 w-6 text-red-600 mt-1" />
                                        <div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-red-600/60">Sering alpa (Top 3)</p><div className="mt-2 space-y-1.5">{statsData.topAlpa.map((u, idx) => u.totalAlpa > 0 && <div key={u.uid} className="flex justify-between items-center"><span className="font-bold text-sm truncate max-w-[180px]">{idx + 1}. {u.name}</span><span className="text-[10px] font-black text-red-600">{u.totalAlpa} hari</span></div>)}</div></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
