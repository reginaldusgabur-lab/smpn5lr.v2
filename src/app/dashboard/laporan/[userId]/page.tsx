'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { format, parseISO, subMonths, addMonths, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchUserMonthlyReportData } from '@/lib/attendance';
import { Download, ChevronLeft, ChevronRight, ArrowLeft, Loader2, User, CalendarDays, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function UserReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const userId = params.userId as string;

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [reportData, setReportData] = useState<any[]>([]);
    const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [academicYear, setAcademicYear] = useState("");

    const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
    const { data: schoolConfig } = useDoc(currentUser, schoolConfigRef);

    const loadData = useCallback(async () => {
        if (!firestore || !userId || !schoolConfig) return;
        setIsLoading(true);
        try {
            const uSnap = await getDoc(doc(firestore, 'users', userId));
            if (uSnap.exists()) setUserData(uSnap.data());
            const data = await fetchUserMonthlyReportData(firestore, userId, currentMonth, schoolConfig);
            setReportData(data);
            const mSnap = await getDoc(doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM')));
            setAcademicYear(mSnap.exists() ? mSnap.data().academicYear : schoolConfig.academicYear || "");
        } catch (e) {
            toast({ variant: 'destructive', title: 'Gagal memuat data' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, userId, currentMonth, schoolConfig, toast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDownloadPdf = () => {
        if (!userData || reportData.length === 0) return;
        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Tanggal', 'Masuk', 'Pulang', 'Status', 'Keterangan']],
            body: reportData.map(item => [
                format(parseISO(item.date), 'eeee, d MMM yyyy', { locale: id }),
                item.checkInTime ? format(parseISO(item.checkInTime), 'HH:mm:ss') : '-',
                item.checkOutTime ? format(parseISO(item.checkOutTime), 'HH:mm:ss') : '-',
                item.status,
                item.description
            ])
        });
        doc.save(`Laporan_${userData.name.replace(/\s+/g, '_')}.pdf`);
    };

    if (isLoading && reportData.length === 0) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8 bg-background">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="px-4 md:px-0 flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-full transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                    <div>
                        <h1 className="text-2xl font-normal tracking-tight">Detail laporan kehadiran</h1>
                        {userData && <p className="text-sm font-bold text-primary flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{userData.name}</p>}
                    </div>
                </div>

                <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative">
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 shadow-sm backdrop-blur-sm"><CalendarIcon className="h-6 w-6" /></div>
                                <div className="space-y-0.5">
                                    <h2 className="font-bold text-2xl tracking-tight">Riwayat Absensi & Izin</h2>
                                    <p className="text-[11px] font-medium text-white/80">Melihat riwayat kehadiran personil.</p>
                                </div>
                            </div>
                            <button onClick={loadData} className="p-2 hover:bg-white/10 rounded-full transition-colors"><RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} /></button>
                        </div>
                    </div>

                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border p-1">
                            <div className="flex items-center">
                                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}><ChevronLeft className="h-5 w-5 text-primary" /></Button>
                                <div className="flex items-center gap-2 px-3 border-r border-muted-foreground/10 mr-1">
                                    <CalendarDays className="h-4 w-4 text-primary/70" />
                                    <div className="flex flex-col"><span className="text-[7px] font-bold text-muted-foreground/50 uppercase leading-none">Tahun ajaran</span><span className="text-[10px] font-black text-primary leading-none mt-0.5">{academicYear}</span></div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-primary capitalize">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={isSameMonth(currentMonth, new Date())}><ChevronRight className="h-5 w-5 text-primary" /></Button>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleDownloadPdf} className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 px-6"><Download className="mr-2 h-4 w-4" /> unduh pdf</Button>
                        </div>

                        <div className="overflow-x-auto border-t">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold text-xs">Tanggal</TableHead>
                                        <TableHead className="text-center font-bold text-xs">Masuk</TableHead>
                                        <TableHead className="text-center font-bold text-xs">Pulang</TableHead>
                                        <TableHead className="text-center font-bold text-xs">Status</TableHead>
                                        <TableHead className="font-bold text-xs">Keterangan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/50 border-muted-foreground/5">
                                            <TableCell className="font-bold text-sm">{format(parseISO(item.date), 'eeee, d MMMM yyyy', { locale: id })}</TableCell>
                                            <TableCell className="text-center font-mono text-xs font-bold">{item.checkInTime ? format(parseISO(item.checkInTime), 'HH:mm:ss') : '-'}</TableCell>
                                            <TableCell className="text-center font-mono text-xs font-bold">{item.checkOutTime ? format(parseISO(item.checkOutTime), 'HH:mm:ss') : '-'}</TableCell>
                                            <TableCell className="text-center"><Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-1 rounded-full text-[10px] uppercase border-none shadow-sm">{item.status === 'Hadir' ? 'HADIR' : item.status.toUpperCase()}</Badge></TableCell>
                                            <TableCell className="text-xs italic text-muted-foreground">{item.description}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}