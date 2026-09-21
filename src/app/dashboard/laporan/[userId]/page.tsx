'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { format, parseISO, startOfMonth, endOfMonth, isSameMonth, subMonths, addMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchUserMonthlyReportData, calculateAttendanceStats } from '@/lib/attendance';
import { Download, ChevronLeft, ChevronRight, ArrowLeft, Loader2, Info, Calculator, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const safeFormat = (dateInput: any, formatString: string): string => {
    if (!dateInput) return '-';
    let date: Date;
    if (typeof dateInput === 'string') date = parseISO(dateInput);
    else if (dateInput.toDate) date = dateInput.toDate();
    else date = new Date(dateInput);
    return format(date, formatString, { locale: id });
};

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

export default function UserReportDetailPage() {
    const params = useParams(); const router = useRouter(); const { user: currentUser } = useUser(); const firestore = useFirestore(); const { toast } = useToast();
    const userId = params.userId as string; const [currentMonth, setCurrentMonth] = useState(new Date());
    const [monthlyReportData, setMonthlyReportData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null); const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true); const [schoolConfig, setSchoolConfig] = useState<any>(null);

    const loadData = useCallback(async () => {
        if (!firestore || !userId) return;
        setIsLoading(true);
        try {
            const [uSnap, cSnap] = await Promise.all([getDoc(doc(firestore, 'users', userId)), getDoc(doc(firestore, 'schoolConfig', 'default'))]);
            if (uSnap.exists()) setUserData(uSnap.data());
            const config = cSnap.data() || {}; setSchoolConfig(config);
            const [report, s] = await Promise.all([fetchUserMonthlyReportData(firestore, userId, currentMonth, config), calculateAttendanceStats(firestore, userId, { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })]);
            setMonthlyReportData(report); setStats(s);
        } catch (e) { toast({ variant: 'destructive', title: 'Gagal memuat' }); }
        finally { setIsLoading(false); }
    }, [firestore, userId, currentMonth, toast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDownloadPdf = () => {
        if (!userData || monthlyReportData.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const config = schoolConfig || {};
        
        doc.setFont('times', 'bold').setFontSize(14).text((config.governmentAgency || 'PEMERINTAH KABUPATEN MANGGARAI').toUpperCase(), pageWidth/2, 15, { align: 'center' });
        doc.text((config.educationAgency || 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA').toUpperCase(), pageWidth/2, 21, { align: 'center' });
        doc.setFontSize(12).text((config.schoolName || 'SMP NEGERI 5 LANGKE REMBONG').toUpperCase(), pageWidth/2, 28, { align: 'center' });
        doc.setLineWidth(0.5).line(14, 34, pageWidth - 14, 34);

        doc.text(`LAPORAN KEHADIRAN: ${userData.name}`, 14, 45);
        doc.setFontSize(10).setFont('times', 'normal').text(`Bulan: ${format(currentMonth, 'MMMM yyyy', { locale: id })}`, 14, 51);

        const tableHead = [['No', 'Tanggal', 'Masuk', 'Pulang', 'Status', 'Poin', 'Keterangan']];
        const tableRows = monthlyReportData.map((item, index) => [
            index + 1, safeFormat(item.date, 'eeee, d MMM yyyy'),
            safeFormat(item.checkInTime, 'HH:mm'), safeFormat(item.checkOutTime, 'HH:mm'),
            item.status, item.points?.toFixed(2), item.description
        ]);

        autoTable(doc, { startY: 55, head: tableHead, body: tableRows, theme: 'grid', styles: { font: 'times', fontSize: 9 } });
        doc.save(`Laporan_${userData.name.replace(/\s+/g, '_')}_${format(currentMonth, 'MMMM_yyyy')}.pdf`);
    };

    if (isLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-center gap-4 px-4 md:px-0">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft /></Button>
                    <div><h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Detail Laporan: {userData?.name}</h1><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Rekapitulasi Kehadiran Harian</p></div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 px-4 md:px-0">
                    <div className="bg-primary/5 p-2 sm:p-6 rounded-xl sm:rounded-3xl border border-primary/10 flex flex-col items-center justify-center text-center">
                        <Label className="text-[6px] sm:text-[10px] font-black uppercase tracking-widest opacity-50 leading-tight">Persentase</Label>
                        <p className="text-sm sm:text-4xl font-black text-primary mt-1 tabular-nums">{stats?.persentase}</p>
                    </div>
                    <div className="bg-emerald-500/5 p-2 sm:p-6 rounded-xl sm:rounded-3xl border border-emerald-500/10 flex flex-col items-center justify-center text-center">
                        <Label className="text-[6px] sm:text-[10px] font-black uppercase tracking-widest opacity-50 leading-tight">Poin</Label>
                        <p className="text-sm sm:text-4xl font-black text-emerald-600 mt-1 tabular-nums">{stats?.totalPoints}</p>
                    </div>
                    <div className="bg-red-500/5 p-2 sm:p-6 rounded-xl sm:rounded-3xl border border-red-500/10 flex flex-col items-center justify-center text-center">
                        <Label className="text-[6px] sm:text-[10px] font-black uppercase tracking-widest opacity-50 leading-tight">Alpa</Label>
                        <p className="text-sm sm:text-4xl font-black text-red-600 mt-1 tabular-nums">{stats?.totalAlpa}</p>
                    </div>
                </div>

                <Card className="rounded-3xl border-none shadow-none bg-card overflow-hidden">
                    <CardHeader className="flex flex-col sm:flex-row items-center justify-between bg-muted/20 p-6 gap-4">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="rounded-xl"><ChevronLeft /></Button>
                            <span className="font-black text-sm uppercase px-4 whitespace-nowrap">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={isSameMonth(currentMonth, new Date())} className="rounded-xl"><ChevronRight /></Button>
                        </div>
                        <Button onClick={handleDownloadPdf} className="w-full sm:w-auto rounded-xl font-bold bg-primary uppercase text-[10px] tracking-widest h-10 px-6"><Download className="mr-2 h-4 w-4" /> Unduh PDF</Button>
                    </CardHeader>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-12 text-center text-[10px] font-black uppercase">No</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Tanggal</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase">Masuk</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase">Pulang</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase">Status</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase">Poin</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyReportData.map((item, i) => (
                                    <TableRow key={item.id} className="hover:bg-primary/5 transition-colors">
                                        <TableCell className="text-center font-bold text-muted-foreground text-xs">{i + 1}</TableCell>
                                        <TableCell className="font-bold text-xs whitespace-nowrap">{format(parseISO(item.date), 'eeee, d MMM yyyy', { locale: id })}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{safeFormat(item.checkInTime, 'HH:mm')}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{safeFormat(item.checkOutTime, 'HH:mm')}</TableCell>
                                        <TableCell className="text-center"><Badge variant={item.status === 'Hadir' ? 'default' : 'destructive'} className="text-[9px] uppercase font-bold px-3">{item.status}</Badge></TableCell>
                                        <TableCell className="text-center font-black text-primary">{item.points?.toFixed(2)}</TableCell>
                                        <TableCell className="text-[10px] italic text-muted-foreground whitespace-nowrap">{item.description}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-6 border-t bg-muted/5">
                        <div className="flex items-center gap-2 mb-4">
                            <Info className="h-4 w-4 text-primary" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Legenda Poin Kehadiran</h3>
                        </div>
                        <PointLegend />
                    </div>
                </Card>
            </div>
        </div>
    );
}
