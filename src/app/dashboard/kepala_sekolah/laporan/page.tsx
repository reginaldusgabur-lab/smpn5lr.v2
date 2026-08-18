'use client';

import { useState, useMemo, useEffect } from 'react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronLeft, ChevronRight, Search, Download, ChevronDown, MoreVertical, CalendarDays, Eye } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, collectionGroup } from 'firebase/firestore';
import { format, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfDay, setHours, setMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { exportToExcel, exportToPdf } from '@/lib/export';

function useStaffAttendanceSummary(currentMonth: Date) {
    const { user } = useUser();
    const firestore = useFirestore();

    const [summary, setSummary] = useState<{ [key: string]: any[] }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [academicYear, setAcademicYear] = useState("");

    const usersQuery = useMemoFirebase(() => 
        query(
            collection(firestore, 'users'), 
            where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']),
            where('status', '==', 'Aktif')
        )
    , [firestore]);
    const { data: users, isLoading: isUsersLoading } = useCollection(user, usersQuery);

    const schoolConfigRef = useMemoFirebase(() => doc(firestore, 'schoolConfig', 'default'), [firestore]);
    const { data: schoolConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

    const monthlyConfigId = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
    const monthlyConfigRef = useMemoFirebase(() => doc(firestore, 'monthlyConfigs', monthlyConfigId), [firestore, monthlyConfigId]);
    const { data: monthlyConfig, isLoading: isMonthlyConfigLoading } = useDoc(user, monthlyConfigRef);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!firestore || !user || !users || !schoolConfig || monthlyConfig === undefined) {
                if (!isUsersLoading && !isConfigLoading && !isMonthlyConfigLoading) setIsLoading(false);
                return;
            }
            
            setIsLoading(true);
            setAcademicYear(monthlyConfig?.academicYear || schoolConfig.academicYear || "");

            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);

            const qAtt = query(collectionGroup(firestore, 'attendanceRecords'), where('checkInTime', '>=', start), where('checkInTime', '<=', end));
            const qAttFB = query(collectionGroup(firestore, 'attendanceRecords'), where('date', '>=', format(start, 'yyyy-MM-dd')), where('date', '<=', format(end, 'yyyy-MM-dd')));
            const qLeave = query(collectionGroup(firestore, 'leaveRequests'), where('status', '==', 'approved'));
            
            const [snapAtt, snapAttFB, snapLeave] = await Promise.all([ getDocs(qAtt), getDocs(qAttFB), getDocs(qLeave) ]);

            const allAttendance = [...snapAtt.docs, ...snapAttFB.docs].map(d => ({...d.data(), id: d.id }));
            const allLeave = snapLeave.docs.map(d => ({ ...d.data(), id: d.id, startDate: d.data().startDate.toDate(), endDate: d.data().endDate.toDate() }));

            const offDays: number[] = schoolConfig?.offDays ?? [0, 6];
            const holidays: string[] = monthlyConfig?.holidays ?? [];
            const workingDays = eachDayOfInterval({ start, end }).filter(day => !offDays.includes(day.getDay()) && !holidays.includes(format(day, 'yyyy-MM-dd')));
            const workingDaysSet = new Set(workingDays.map(d => format(d, 'yyyy-MM-dd')));

            const userSummary = users.map((u: any) => {
                let points = 0;
                let hadirCount = 0;
                let izinCount = 0;
                let sakitCount = 0;
                const processedDates = new Set<string>();

                allAttendance.filter(att => att.userId === u.id).forEach((att: any) => {
                    const dStr = att.date || (att.checkInTime ? format(att.checkInTime.toDate(), 'yyyy-MM-dd') : null);
                    if (dStr && workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                        let p = 0;
                        const desc = (att.reasonForUpdate || '').toLowerCase();
                        if (desc.includes('dinas') || desc.includes('pulang cepat')) p = 1.0;
                        else if (att.checkInTime && att.checkOutTime) {
                            let isLate = false;
                            if (schoolConfig.useTimeValidation && schoolConfig.checkInEndTime) {
                                const deadline = setMinutes(setHours(startOfDay(att.checkInTime.toDate()), parseInt(schoolConfig.checkInEndTime.split(':')[0])), parseInt(schoolConfig.checkInEndTime.split(':')[1]));
                                if (att.checkInTime.toDate() > deadline) isLate = true;
                            }
                            p = isLate ? 0.95 : 1.0;
                        } else p = 0.5;
                        points += p; hadirCount++; processedDates.add(dStr);
                    }
                });

                allLeave.filter(l => l.userId === u.id).forEach(leave => {
                    eachDayOfInterval({ start: leave.startDate, end: leave.endDate }).forEach(day => {
                        const dStr = format(day, 'yyyy-MM-dd');
                        if (workingDaysSet.has(dStr) && !processedDates.has(dStr)) {
                            let p = 0;
                            if (leave.type === 'Sakit') { p = 0.9; sakitCount++; }
                            else if (leave.type === 'Izin' || leave.type === 'Izin Pribadi') { p = 0.7; izinCount++; }
                            else { p = 1.0; hadirCount++; }
                            points += p; processedDates.add(dStr);
                        }
                    });
                });

                const pastWorkingDays = workingDays.filter(day => isBefore(day, startOfDay(new Date())) || isSameDay(day, new Date()));
                const alpaCount = pastWorkingDays.filter(day => !processedDates.has(format(day, 'yyyy-MM-dd'))).length;

                const presentasi = Math.min((points / (workingDays.length || 1)) * 100, 100).toFixed(1) + '%';
                return { ...u, hadir: hadirCount, izin: izinCount, sakit: sakitCount, alpa: alpaCount, terlambat: 0, presentasi };
            });

            const groupedByRole = userSummary.reduce((acc: any, user: any) => {
                const role = user.role;
                (acc[role] = acc[role] || []).push(user);
                return acc;
            }, {});
            
            ['guru', 'pegawai', 'kepala_sekolah'].forEach(role => {
                if(groupedByRole[role]) groupedByRole[role].sort((a:any, b:any) => (a.sequenceNumber || 999) - (b.sequenceNumber || 999));
            });

            setSummary(groupedByRole);
            setIsLoading(false);
        };
        fetchAllData();
    }, [firestore, user, users, schoolConfig, monthlyConfig, currentMonth, isUsersLoading, isConfigLoading, isMonthlyConfigLoading]);

    return { summary, isLoading, academicYear, schoolConfig };
}

const StaffReportTable = ({ data, isLoading, currentMonth }: { data: any[], isLoading: boolean, currentMonth: Date }) => {
    const router = useRouter();
    if (isLoading) return <div className="space-y-3 pt-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>;

    return (
        <div className="overflow-x-auto border rounded-xl mt-4">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="border-none">
                        <TableHead className="w-[50px] text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">No</TableHead>
                        <TableHead className="min-w-[200px] font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Nama & Identitas</TableHead>
                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Hadir</TableHead>
                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Izin</TableHead>
                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Sakit</TableHead>
                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Alpa</TableHead>
                        <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">%</TableHead>
                        <TableHead className="w-[80px] text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-none">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data && data.length > 0 ? (
                        data.map((item, index) => (
                            <TableRow key={item.id} className="hover:bg-primary/5 transition-colors border-muted-foreground/5">
                                <TableCell className="text-center font-bold text-muted-foreground text-sm">{item.sequenceNumber || index + 1}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-foreground">{item.name}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground">{item.nip}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-black text-green-600">
                                    {Math.ceil(item.hadir)}
                                </TableCell>
                                <TableCell className="text-center font-black text-blue-500">
                                    {item.izin}
                                </TableCell>
                                <TableCell className="text-center font-black text-orange-500">
                                    {item.sakit}
                                </TableCell>
                                <TableCell className="text-center font-black text-red-500">
                                    {item.alpa}
                                </TableCell>
                                <TableCell className="text-center font-black text-primary">
                                    {item.presentasi}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => router.push(`/dashboard/laporan/${item.id}?month=${format(currentMonth, 'yyyy-MM')}`)}>
                                        <Eye className="h-4 w-4 text-primary" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : <TableRow><TableCell colSpan={8} className="h-48 text-center font-bold text-muted-foreground opacity-40 uppercase text-xs tracking-widest">Tidak ada data.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </div>
    );
};

function StaffReportView() {
  const [activeTab, setActiveTab] = useState('guru');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const { summary, isLoading, academicYear, schoolConfig } = useStaffAttendanceSummary(currentMonth);

  const minDate = new Date(2026, 0, 1);
  const filteredData = useMemo(() => (summary[activeTab] || []).filter((u: any) => u.name.toLowerCase().includes(searchQuery.toLowerCase())), [summary, activeTab, searchQuery]);

  return (
    <div className="flex-1 pt-2 pb-24 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="px-4 md:px-0"><h1 className="text-3xl font-normal tracking-tight">Laporan Staf</h1></div>
        <Card className="w-full border border-muted-foreground/10 shadow-md rounded-xl bg-card">
          <CardHeader>
             <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div><CardTitle className="font-normal">Rekapitulasi Kehadiran</CardTitle><CardDescription>Pilih kategori staf dan bulan untuk melihat laporan.</CardDescription></div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full sm:w-auto font-normal"><Download className="mr-2 h-4 w-4" />Unduh Laporan<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => exportToExcel(summary, currentMonth, activeTab)} disabled={isLoading}>Unduh Excel</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToPdf(summary, currentMonth, activeTab, schoolConfig, academicYear)} disabled={isLoading || !schoolConfig}>Unduh PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <TabsList className="overflow-x-auto whitespace-nowrap"><TabsTrigger value="guru">Data Guru</TabsTrigger><TabsTrigger value="pegawai">Data Pegawai</TabsTrigger><TabsTrigger value="kepala_sekolah">Kepala Sekolah</TabsTrigger></TabsList>
                    
                    <div className="flex w-full items-center justify-center md:justify-end gap-2 md:w-auto">
                         <div className="flex items-center justify-between w-full md:w-auto bg-muted/40 rounded-2xl border border-muted-foreground/5 p-1 shrink-0">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} disabled={isLoading || currentMonth <= minDate}><ChevronLeft className="h-4 w-4 text-primary" /></Button>
                                
                                <div className="flex items-center gap-1.5 px-2 border-l border-muted-foreground/10 min-w-max">
                                    <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                                    <div className="flex flex-col min-w-max">
                                        <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">THN AJARAN</span>
                                        <span className="text-[10px] font-black text-primary leading-none mt-0.5 whitespace-nowrap">{academicYear || "-"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-primary tracking-tight text-center capitalize whitespace-nowrap min-w-[100px]">
                                    {format(currentMonth, 'MMMM yyyy', { locale: id })}
                                </span>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={isLoading || isSameMonth(currentMonth, new Date())}><ChevronRight className="h-4 w-4 text-primary" /></Button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="bg-muted/20 p-4 rounded-2xl border border-muted-foreground/5 mb-6">
                    <div className="space-y-1.5 max-w-md">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cari Nama</Label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                            <Input placeholder="Cari nama personil..." className="pl-11 h-11 rounded-xl bg-background border-muted-foreground/10 font-bold text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                </div>

                <TabsContent value="guru"><StaffReportTable data={filteredData} isLoading={isLoading} currentMonth={currentMonth} /></TabsContent>
                <TabsContent value="pegawai"><StaffReportTable data={filteredData} isLoading={isLoading} currentMonth={currentMonth} /></TabsContent>
                <TabsContent value="kepala_sekolah"><StaffReportTable data={filteredData} isLoading={isLoading} currentMonth={currentMonth} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function HeadmasterStaffReportPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { data: userData, isLoading: isUserDataLoading } = useDoc(user, useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]));

    useEffect(() => {
        if (!isUserLoading && !isUserDataLoading) {
            if (!user) router.replace('/');
            else if (userData?.role !== 'kepala_sekolah') router.replace('/dashboard');
        }
    }, [isUserLoading, isUserDataLoading, user, userData, router]);

    if (isUserLoading || isUserDataLoading || userData?.role !== 'kepala_sekolah') return <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    return <StaffReportView />;
}
