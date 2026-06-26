'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, startOfMonth, parseISO, isValid, endOfMonth, endOfDay, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { doc, writeBatch, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight, CheckCircle2, XCircle, FileWarning, CalendarClock, MoreVertical } from 'lucide-react';

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
        const hadir = reportDetails.filter(d => d.status === 'Hadir' || d.status === 'Terlambat').length;
        const sakit = reportDetails.filter(d => d.status === 'Sakit').length;
        const izin = reportDetails.filter(d => d.status === 'Izin' || d.status === 'Dinas').length;
        const alpa = reportDetails.filter(d => d.status === 'Alpa').length;
        return { hadir, sakit, izin, alpa };
    }, [reportDetails]);

    const chartData = [
        { name: 'Hadir', Jumlah: summaryStats.hadir, fill: '#22c55e' },
        { name: 'Sakit', Jumlah: summaryStats.sakit, fill: '#f97316' },
        { name: 'Izin', Jumlah: summaryStats.izin, fill: '#3b82f6' },
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

            toast({ title: 'Sukses', description: `Status berhasil diubah menjadi ${newStatus}.` });
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Hadir': return <Badge variant="default" className="bg-green-100 text-green-800">Hadir</Badge>;
            case 'Terlambat': return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Terlambat</Badge>;
            case 'Tidak Absen Pulang': return <Badge variant="secondary">Tidak Absen Pulang</Badge>;
            case 'Belum Absen Pulang': return <Badge variant="outline">Belum Absen</Badge>;
            case 'Sakit': return <Badge variant="default" className="bg-orange-100 text-orange-800">Sakit</Badge>;
            case 'Izin': return <Badge variant="default" className="bg-blue-100 text-blue-800">Izin</Badge>;
            case 'Dinas': return <Badge variant="default" className="bg-purple-100 text-purple-800">Dinas</Badge>;
            case 'Alpa': 
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Badge variant="destructive" className="cursor-pointer hover:bg-destructive/80">
                                Alpa <MoreVertical className="h-3 w-3 ml-1" />
                            </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleStatusChange(reportDetails.find(d => d.status === 'Alpa')!.date, 'Sakit', 'Sakit (✓)')}>Ubah ke Sakit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(reportDetails.find(d => d.status === 'Alpa')!.date, 'Izin', 'Izin (✓)')}>Ubah ke Izin</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(reportDetails.find(d => d.status === 'Alpa')!.date, 'Dinas', 'Dinas Pagi (✓)')}>Ubah ke Dinas Pagi</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(reportDetails.find(d => d.status === 'Alpa')!.date, 'Dinas', 'Dinas Siang (✓)')}>Ubah ke Dinas Siang</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleDownloadPdf = () => {
      // ... (rest of the function is unchanged)
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* --- Header Cards --- */}
             <Card>
                <CardHeader>
                    <CardTitle>Ringkasan Laporan Bulan {format(currentMonth, 'MMMM yyyy', { locale: id })}</CardTitle>
                    <CardDescription>Grafik ringkasan kehadiran untuk {userData?.name || 'Pengguna'}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="Jumlah" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="flex flex-col justify-center items-center text-center">
                                <CardHeader><CardTitle className="text-3xl">{summaryStats.hadir}</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="text-green-500"/> Hadir</p></CardContent>
                            </Card>
                             <Card className="flex flex-col justify-center items-center text-center">
                                <CardHeader><CardTitle className="text-3xl">{summaryStats.alpa}</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground flex items-center gap-2"><XCircle className="text-red-500"/> Alpa</p></CardContent>
                            </Card>
                             <Card className="flex flex-col justify-center items-center text-center">
                                <CardHeader><CardTitle className="text-3xl">{summaryStats.izin}</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground flex items-center gap-2"><FileWarning className="text-blue-500"/> Izin</p></CardContent>
                            </Card>
                             <Card className="flex flex-col justify-center items-center text-center">
                                <CardHeader><CardTitle className="text-3xl">{summaryStats.sakit}</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground flex items-center gap-2"><CalendarClock className="text-orange-500"/> Sakit</p></CardContent>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- Details Table --- */}
            <Card>
                <CardHeader>
                    <CardTitle>Detail Laporan Harian</CardTitle>
                    <CardDescription>Rincian data kehadiran harian yang terekam oleh sistem.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="w-36 text-center font-semibold">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                            <Button variant="outline" size="icon" onClick={() => handleMonthChange(1)} disabled={currentMonth >= endOfMonth(new Date())}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                        <Button onClick={() => {}} disabled={!userData || isSubmitting}>
                            <Download className="mr-2 h-4 w-4" />
                            Unduh Laporan PDF
                        </Button>
                    </div>
                    <div className="overflow-x-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[5%]">No</TableHead>
                                    <TableHead className="w-[20%]">Tanggal</TableHead>
                                    <TableHead className="w-[15%]">Jam Masuk</TableHead>
                                    <TableHead className="w-[15%]">Jam Pulang</TableHead>
                                    <TableHead className="w-[15%]">Status</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportDetails.length > 0 ? (
                                    reportDetails.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-muted/50">
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{safeFormat(item.date, 'EEEE, dd MMMM yyyy')}</TableCell>
                                            <TableCell>{safeFormat(item.checkInTime, 'HH:mm:ss')}</TableCell>
                                            <TableCell>{safeFormat(item.checkOutTime, 'HH:mm:ss')}</TableCell>
                                            <TableCell className="font-medium">
                                                {getStatusBadge(item.status)}
                                            </TableCell>
                                            <TableCell>
                                                {item.status === 'Tidak Absen Pulang' ? (
                                                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => handleNavigateToManualEntry(item.date)}>
                                                        Edit Kehadiran
                                                    </Button>
                                                ) : item.description}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            Tidak ada data kehadiran untuk ditampilkan pada periode ini.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
