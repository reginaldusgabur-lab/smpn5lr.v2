'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, FileText, Calendar, Info, Calculator, TrendingUp } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { format, isSameMonth, addMonths, subMonths, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateAttendanceStats, fetchUserMonthlyReportData } from '@/lib/attendance';
import { getFromCache, setInCache, invalidateCache } from '@/lib/cache';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReportItem {
  id: string;
  date: string;
  dateString: string;
  checkIn: string;
  checkOut: string;
  status: string;
  description: string;
  points: number;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
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

export default function LaporanPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyReportData, setMonthlyReportData] = useState<ReportItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState("");

  const schoolConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'schoolConfig', 'default');
  }, [firestore]);
  const { data: schoolConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  useEffect(() => {
    if (schoolConfig?.academicYear && !academicYear) {
      setAcademicYear(schoolConfig.academicYear);
    }
  }, [schoolConfig, academicYear]);

  const cacheKey = useMemo(() => user ? `user_report_v215_${user.uid}_${format(currentMonth, 'yyyyMM')}` : null, [user, currentMonth]);

  const fetchReport = useCallback(async (forceRefresh = false) => {
    if (!user || !firestore || !schoolConfig || !cacheKey) return;
    
    setIsReportLoading(true);

    if (!forceRefresh) {
        const cachedData = getFromCache(cacheKey);
        if (cachedData) {
            setMonthlyReportData(cachedData);
            setIsReportLoading(false);
            return;
        }
    }

    try {
        const rawReport = await fetchUserMonthlyReportData(firestore, user.uid, currentMonth, schoolConfig);
        
        const formattedReport: ReportItem[] = rawReport.map((record: any) => ({
            id: record.id,
            date: record.date, 
            dateString: format(parseISO(record.date), 'eee, dd/MM/yy', { locale: id }),
            checkIn: record.checkInTime ? format(parseISO(record.checkInTime), 'HH:mm') : '-',
            checkOut: record.checkOutTime ? format(parseISO(record.checkOutTime), 'HH:mm') : '-',
            status: record.status,
            description: record.description,
            points: record.points,
            approvalStatus: record.approvalStatus
        }));

        setMonthlyReportData(formattedReport);
        setInCache(cacheKey, formattedReport);

        const monthlyConfigRef = doc(firestore, 'monthlyConfigs', format(currentMonth, 'yyyy-MM'));
        const mSnap = await getDoc(monthlyConfigRef);
        const mData = mSnap.exists() ? mSnap.data() : {};
        setAcademicYear(mData.academicYear || schoolConfig.academicYear || "");

    } catch (error) {
        console.error("Failed to fetch monthly report:", error);
        toast({ title: "Gagal Memuat Laporan", description: "Terjadi kesalahan saat mengambil data.", variant: "destructive" });
    } finally {
        setIsReportLoading(false);
    }
  }, [user, firestore, currentMonth, schoolConfig, cacheKey, toast]);

  useEffect(() => {
    if (!isConfigLoading && schoolConfig) {
        fetchReport();
    }
  }, [fetchReport, isConfigLoading, schoolConfig]);

  useEffect(() => {
    if (user?.uid && firestore && !isConfigLoading) {
        const fetchStats = async () => {
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);
            const res = await calculateAttendanceStats(firestore, user.uid, { start, end });
            setStats(res);
        };
        fetchStats();
    }
  }, [user?.uid, firestore, currentMonth, isConfigLoading]);

  const handleRefresh = () => {
      if (cacheKey) invalidateCache(cacheKey);
      fetchReport(true);
  };

  const handlePrevMonth = () => {
    const minDate = new Date(2026, 0, 1);
    setCurrentMonth(prev => {
        const next = subMonths(prev, 1);
        return next < minDate ? prev : next;
    });
  };

  const handleNextMonth = () => {
      setCurrentMonth(prev => addMonths(prev, 1));
  };

  const getStatusColorClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'hadir' || s === 'terlambat') return "bg-emerald-500/10 text-emerald-600";
    if (s === 'sakit') return "bg-orange-500/10 text-orange-600";
    if (s.includes('izin')) return "bg-amber-500/10 text-amber-600";
    if (s === 'alpa') return "bg-red-500/10 text-red-600";
    return "bg-primary/10 text-primary";
  };

  const isLoading = isAuthLoading || isConfigLoading || isReportLoading;
  const canGoPrev = currentMonth > new Date(2026, 0, 1);

  if (isLoading && monthlyReportData.length === 0) {
    return (
        <div className="flex-1 pt-0 pb-24 md:p-8">
            <div className="max-w-7xl auto space-y-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </div>
    );
  }

  return (
    <div className="flex-1 pt-0 pb-24 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
            <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-xl">
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
                      <p className="text-[11px] font-medium text-white/80 leading-relaxed">Berikut adalah catatan kehadiran dan pengajuan izin Anda.</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10 shadow-none" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </div>
              </div>

              <CardContent className="p-0">
                <div className="p-4 flex items-center justify-center">
                    <div className="flex items-center justify-between w-full bg-muted/40 rounded-2xl border border-muted-foreground/5 p-1">
                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={handlePrevMonth} disabled={isLoading || !canGoPrev}>
                                <ChevronLeft className="h-5 w-5 text-primary" />
                            </Button>
                            
                            <div className="flex items-center gap-1 pl-0.5 pr-2 border-r border-muted-foreground/10 mr-1 min-w-max">
                                <CalendarDays className="h-4 w-4 text-primary/70" />
                                <div className="flex flex-col">
                                    <span className="text-[7px] font-black uppercase text-muted-foreground/60 leading-none">Tahun ajaran</span>
                                    <span className="text-[10px] font-black text-primary leading-none mt-0.5">{academicYear || "-"}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-primary capitalize px-2">
                                {format(currentMonth, 'MMMM yyyy', { locale: id })}
                            </span>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={handleNextMonth} disabled={isSameMonth(currentMonth, new Date())}>
                                <ChevronRight className="h-5 w-5 text-primary" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-muted-foreground/5 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-none">
                                <TableHead className="w-[60px] text-center font-bold text-xs text-muted-foreground border-none h-11">No</TableHead>
                                <TableHead className="font-bold text-xs text-muted-foreground border-none h-11">Tanggal</TableHead>
                                <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Masuk</TableHead>
                                <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Pulang</TableHead>
                                <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Poin</TableHead>
                                <TableHead className="text-center font-bold text-xs text-muted-foreground border-none h-11">Status</TableHead>
                                <TableHead className="font-bold text-xs text-muted-foreground border-none h-11">Keterangan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthlyReportData.length > 0 ? (
                                monthlyReportData.map((record, index) => (
                                    <TableRow key={record.id} className="hover:bg-primary/5 transition-colors border-muted-foreground/5">
                                        <TableCell className="text-center font-bold text-muted-foreground text-sm">{index + 1}</TableCell>
                                        <TableCell className="font-bold text-sm text-foreground whitespace-nowrap">{record.dateString}</TableCell>
                                        <TableCell className="text-center font-mono text-xs font-bold">{record.checkIn}</TableCell>
                                        <TableCell className="text-center font-mono text-xs font-bold">{record.checkOut}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-black text-[10px] bg-background text-primary border-primary/20">
                                                {record.points.toFixed(2)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap",
                                                getStatusColorClass(record.status)
                                            )}>
                                                {record.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-[11px] font-medium text-muted-foreground italic truncate max-w-[200px]">{record.description}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center font-bold text-muted-foreground opacity-40 text-xs tracking-widest">Tidak ada data.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* PERHITUNGAN DAN LEGENDA DIPINDAH KE AKHIR HALAMAN */}
                <div className="p-6 border-t border-muted-foreground/10 space-y-6 bg-muted/5">
                    <div className="bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-primary/10 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2">
                            <div className="p-5 flex flex-col items-center justify-center text-center border-r border-primary/5">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] mb-2 leading-none">Total Akumulasi Poin</p>
                                <div className="flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-primary opacity-30 shrink-0" />
                                    <span className="text-3xl font-black text-primary mt-1.5 tabular-nums leading-none">
                                        {stats?.totalPoints || "0.00"}
                                    </span>
                                </div>
                            </div>
                            <div className="p-5 flex flex-col items-center justify-center text-center">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] mb-2 leading-none">Persentase Kehadiran</p>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-600 opacity-30 shrink-0" />
                                    <span className="text-3xl font-black text-green-600 mt-1.5 tabular-nums leading-none">
                                        {stats?.persentase || "0.0%"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Informasi Skema Poin</h3>
                        </div>
                        <PointLegend />
                    </div>
                </div>
              </CardContent>
            </Card>
        </div>
    </div>
  );
}
