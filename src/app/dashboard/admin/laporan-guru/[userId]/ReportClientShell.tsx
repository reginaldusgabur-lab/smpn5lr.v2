
'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, startOfMonth, parseISO, isValid, endOfMonth, endOfDay, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { doc, writeBatch, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight, CheckCircle2, XCircle, FileWarning, CalendarClock, MoreVertical, RefreshCw, Calendar, FileText, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Type Definitions ---
interface ReportDetail {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  description: string;
}

interface UserData { name?: string; }
interface ClientShellProps {
  userId: string;
  initialUserData: UserData;
  initialReportData: ReportDetail[];
  initialMonth: string;
  initialSchoolConfig: any;
}

// --- Main Component ---
export default function ReportClientShell({ 
    userId, 
    initialUserData,
    initialReportData,
    initialMonth,
}: ClientShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();

    const [userData] = useState<UserData>(initialUserData);
    const [reportDetails, setReportDetails] = useState<ReportDetail[]>(initialReportData || []);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        return isValid(dateObj) ? format(dateObj, formatString, { locale: id }) : '-';
    }

    const handleStatusChange = async (date: string, newStatus: 'Sakit' | 'Izin' | 'Dinas', reason: string) => {
        if (!authUser || !firestore) return;
        setIsSubmitting(true);
        try {
            const targetDate = parseISO(date);
            const batch = writeBatch(firestore);
            
            const leaveRef = collection(firestore, 'users', userId, 'leaveRequests');
            const newLeaveDoc = doc(leaveRef);
            batch.set(newLeaveDoc, {
                userId,
                type: newStatus,
                status: 'approved',
                reason,
                startDate: Timestamp.fromDate(startOfDay(targetDate)),
                endDate: Timestamp.fromDate(endOfDay(targetDate)),
                createdAt: serverTimestamp(),
                approvedBy: authUser.uid,
                approvedAt: serverTimestamp(),
                createdBy: authUser.uid,
            });

            await batch.commit();
            
            // Optimistic UI update
            setReportDetails(prevDetails => 
                prevDetails.map(item => 
                    item.date === date ? { ...item, id: newLeaveDoc.id, status: newStatus, description: reason } : item
                )
            );

            toast({ title: 'Sukses', description: `Status berhasil diubah menjadi ${reason}.` });
        } catch (error) {
            console.error("Error changing status:", error);
            toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan saat mengubah status.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNavigateToManualEntry = (date: string) => {
        const formattedDate = format(parseISO(date), 'yyyy-MM-dd');
        router.push(`/dashboard/admin/kehadiran/${userId}/manual?date=${formattedDate}`);
    };

    const getStatusColorClass = (status: string, desc: string, hasOut: boolean) => {
        const s = status.toLowerCase();
        const d = (desc || '').toLowerCase();
        
        if (s === 'alpa') return "bg-red-500 text-white";
        if (s === 'sakit') return "bg-orange-500 text-white";
        if (s.includes('izin') || s.includes('dinas') || s.includes('kegiatan')) return "bg-amber-500 text-white";
        
        // DISTINCTION: Hadir tapi belum pulang vs Hadir sudah pulang
        if (s === 'hadir' || s === 'terlambat') {
            if (!hasOut && !d.includes('tugas') && !d.includes('pulang cepat')) {
                return "bg-blue-600 text-white"; // Sedang di sekolah
            }
            return "bg-emerald-500 text-white"; // Sudah pulang/tuntas
        }
        
        return "bg-primary text-white";
    };

    const getStatusBadge = (status: string, item: ReportDetail) => {
        const hasOut = !!item.checkOutTime;
        const isManualLate = (status === 'Terlambat' || item.description === 'Terlambat');
        const displayStatus = isManualLate ? 'Hadir' : status;
        const colorClass = getStatusColorClass(displayStatus, item.description, hasOut);
        const baseClass = "inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap border-none shadow-none";

        if (status === 'Alpa' && !isManualLate) {
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={cn(baseClass, colorClass, "cursor-pointer hover:opacity-80 flex items-center justify-center gap-1 mx-auto")}>
                            Alpa <MoreVertical className="h-3 w-3" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-xl border-none shadow-xl p-2">
                        <DropdownMenuItem className="rounded-lg py-2 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Sakit', 'Sakit')}>Ubah ke Sakit</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg py-2 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Izin', 'Izin Pribadi')}>Ubah ke Izin</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg py-2 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Dinas', 'Dinas Pagi')}>Ubah ke Dinas Pagi</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg py-2 font-bold text-xs" onClick={() => handleStatusChange(item.date, 'Dinas', 'Dinas Siang')}>Ubah ke Dinas Siang</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        }

        return <span className={cn(baseClass, colorClass, "mx-auto")}>{displayStatus}</span>;
    };

    const canGoPrev = currentMonth > new Date(2026, 0, 1);

    return (
        <div className="p-2 sm:p-6 space-y-4">
            {/* --- Header Cards --- */}
             <Card className="rounded-xl border border-muted-foreground/10 shadow-none overflow-hidden bg-primary/5">
                <CardHeader className="p-4 border-b border-muted-foreground/10">
                    <CardTitle className="text-xs uppercase font-bold tracking-tight text-primary">Ringkasan Bulan {format(currentMonth, 'MMMM yyyy', { locale: id })}</CardTitle>
                    <CardDescription className="text-[10px] font-bold">Grafik ringkasan kehadiran untuk {userData?.name || 'Pengguna'}.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontStyle: 'normal', fontWeight: 'bold' }} />
                                    <YAxis hide />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="Jumlah" radius={[4, 4, 0, 0]} barSize={40}>
                                        {chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Card className="flex flex-col justify-center items-center text-center p-3 rounded-xl bg-muted/20 border-none shadow-none">
                                <span className="text-2xl font-bold text-green-600">{summaryStats.hadir}</span>
                                <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider mt-1"><CheckCircle2 className="h-3 w-3 text-green-500"/> Hadir</p>
                            </Card>
                             <Card className="flex flex-col justify-center items-center text-center p-3 rounded-xl bg-muted/20 border-none shadow-none">
                                <span className="text-2xl font-bold text-red-600">{summaryStats.alpa}</span>
                                <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider mt-1"><XCircle className="h-3 w-3 text-red-500"/> Alpa</p>
                            </Card>
                             <Card className="flex flex-col justify-center items-center text-center p-3 rounded-xl bg-muted/20 border-none shadow-none">
                                <span className="text-2xl font-bold text-amber-600">{summaryStats.izin}</span>
                                <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider mt-1"><FileWarning className="h-3 w-3 text-amber-500"/> Izin</p>
                            </Card>
                             <Card className="flex flex-col justify-center items-center text-center p-3 rounded-xl bg-muted/20 border-none shadow-none">
                                <span className="text-2xl font-bold text-orange-600">{summaryStats.sakit}</span>
                                <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider mt-1"><CalendarClock className="h-3 w-3 text-orange-500"/> Sakit</p>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- Details Table --- */}
            <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-2xl p-0">
                {/* Header Card - Biru Gradasi Persis Gambar */}
                <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                    {/* Ikon Laporan Dekoratif (Samar di sebelah kanan) */}
                    <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12">
                        <FileText className="w-24 h-24 text-white" />
                    </div>
                    
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="font-bold text-2xl tracking-tight leading-tight">Detail Laporan Harian</h2>
                                <p className="text-[11px] font-medium text-white/80 leading-relaxed">Rincian catatan kehadiran personil setiap hari.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-0 bg-blue-600">
                    {/* Area Pemilihan Bulan & Navigasi - Warna Biru Menyatu */}
                    <div className="p-4 space-y-4 bg-blue-600">
                        <div className="flex flex-col items-center justify-center gap-4 py-2">
                            <div className="flex items-center bg-white/10 rounded-2xl border border-white/10 p-1 shrink-0">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-10 w-10 rounded-xl hover:bg-white/10 shadow-none shrink-0 text-white" 
                                    onClick={() => handleMonthChange(-1)} 
                                    disabled={!canGoPrev}
                                >
                                    <ChevronLeft className="h-5 w-5 text-white" />
                                </Button>
                                <div className="flex items-center gap-1.5 pl-0.5 pr-3 border-r border-white/20 mr-1.5 min-w-max">
                                    <CalendarDays className="h-4 w-4 text-white" />
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-bold uppercase text-white/60 tracking-[0.1em] leading-none">Thn ajaran</span>
                                        <span className="text-[10px] font-black text-white leading-none mt-0.5 whitespace-nowrap">2026/2027</span>
                                    </div>
                                </div>
                                <span className="w-40 text-center font-bold text-sm text-white tracking-tight capitalize whitespace-nowrap">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-10 w-10 rounded-xl hover:bg-white/10 shadow-none shrink-0 text-white" 
                                    onClick={() => handleMonthChange(1)} 
                                    disabled={currentMonth >= endOfMonth(new Date())}
                                >
                                    <ChevronRight className="h-5 w-5 text-white" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-blue-600">
                                <TableRow className="border-none">
                                    <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase tracking-[0.15em] text-white border-none h-11">No</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-[0.15em] text-white border-none h-11">Tanggal</TableHead>
                                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-[0.15em] text-white border-none h-11">Masuk</TableHead>
                                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-[0.15em] text-white border-none h-11">Pulang</TableHead>
                                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-[0.15em] text-white border-none h-11">Status</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-[0.15em] text-white border-none h-11">Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="bg-background">
                                {reportDetails.length > 0 ? (
                                    reportDetails.map((item, index) => {
                                        const isManualLate = (item.status === 'Terlambat' || item.description === 'Terlambat') && !item.checkInTime;
                                        return (
                                            <TableRow key={item.id} className="hover:bg-muted/50 border-muted-foreground/5">
                                                <TableCell className="text-center font-bold text-xs text-muted-foreground">{index + 1}</TableCell>
                                                <TableCell className="font-bold text-sm whitespace-nowrap">{safeFormat(item.date, 'eeee, dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold">
                                                    {isManualLate ? <span className="text-red-600 font-black">-</span> : <span className="text-foreground">{safeFormat(item.checkInTime, 'HH:mm:ss')}</span>}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-foreground">{safeFormat(item.checkOutTime, 'HH:mm:ss')}</TableCell>
                                                <TableCell className="text-center">
                                                    {getStatusBadge(item.status, item)}
                                                </TableCell>
                                                <TableCell>
                                                    {item.status === 'Tidak Absen Pulang' ? (
                                                        <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold uppercase tracking-tight" onClick={() => handleNavigateToManualEntry(item.date)}>
                                                            Perbaiki
                                                        </Button>
                                                    ) : <span className="text-[10px] font-medium italic opacity-70">{item.description}</span>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center font-bold text-muted-foreground opacity-40 uppercase text-[10px] tracking-widest">
                                            Tidak ada data untuk periode ini.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </Card>
        </div>
    );
}
