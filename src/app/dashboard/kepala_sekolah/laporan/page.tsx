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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

const StaffReportListView = ({ data, isLoading, currentMonth }: { data: any[], isLoading: boolean, currentMonth: Date }) => {
    const router = useRouter();
    const rowAccentColors = ['bg-blue-600', 'bg-indigo-600', 'bg-cyan-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500'];

    if (isLoading) return <div className="space-y-3 pt-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>;

    return (
        <div className="p-0 lg:p-2 space-y-3 pt-4">
            {/* Static Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
                <div className="col-span-1 text-center">No</div>
                <div className="col-span-5 pl-12">Nama & NIP</div>
                <div className="col-span-6 grid grid-cols-4 gap-2 text-center">
                    <div>Hadir</div>
                    <div>Izin</div>
                    <div>Sakit</div>
                    <div>Alpa</div>
                </div>
            </div>

            {data && data.length > 0 ? (
                data.map((item, index) => {
                    const accentColor = rowAccentColors[index % rowAccentColors.length];
                    return (
                        <div key={item.id} className="relative bg-card border border-border/40 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                            {/* Left Accent Bar */}
                            <div className={cn("absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full", accentColor)} />
                            
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pl-4">
                                {/* NO Column */}
                                <div className="hidden lg:flex lg:col-span-1 justify-center">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-sm", accentColor.replace('bg-', 'bg-').replace('600', '10').replace('500', '10'), accentColor.replace('bg-', 'text-'))}>
                                        {item.sequenceNumber || index + 1}
                                    </div>
                                </div>

                                {/* NAMA & NIP Column */}
                                <div className="col-span-1 lg:col-span-5 flex items-center gap-4">
                                    <div className="lg:hidden w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary shrink-0">
                                        {item.sequenceNumber || index + 1}
                                    </div>
                                    <Avatar className="h-11 w-11 border-2 border-background shadow-sm shrink-0">
                                        <AvatarImage src={item.photoURL} />
                                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{getInitials(item.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm text-foreground truncate" title={item.name}>{item.name}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground tracking-tight">{item.nip}</span>
                                    </div>
                                </div>

                                {/* STATS Column */}
                                <div className="col-span-1 lg:col-span-6 grid grid-cols-4 gap-2 text-center">
                                    <div className="bg-emerald-500/5 rounded-xl p-2 border border-emerald-500/10">
                                        <p className="text-sm font-black text-emerald-600 leading-none">{Math.ceil(item.hadir)}</p>
                                        <p className="text-[8px] font-bold text-emerald-600/60 uppercase mt-1">Hadir</p>
                                    </div>
                                    <div className="bg-blue-500/5 rounded-xl p-2 border border-blue-500/10">
                                        <p className="text-sm font-black text-blue-600 leading-none">{item.izin}</p>
                                        <p className="text-[8px] font-bold text-blue-600/60 uppercase mt-1">Izin</p>
                                    </div>
                                    <div className="bg-orange-500/5 rounded-xl p-2 border border-orange-500/10">
                                        <p className="text-sm font-black text-orange-600 leading-none">{item.sakit}</p>
                                        <p className="text-[8px] font-bold text-orange-600/60 uppercase mt-1">Sakit</p>
                                    </div>
                                    <div className="bg-red-500/5 rounded-xl p-2 border border-red-500/10">
                                        <p className="text-sm font-black text-red-600 leading-none">{item.alpa}</p>
                                        <p className="text-[8px] font-bold text-red-600/60 uppercase mt-1">Alpa</p>
                                    </div>
                                </div>
                                
                                {/* Action */}
                                <div className="lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10 group-hover:scale-110 transition-all" onClick={() => router.push(`/dashboard/laporan/${item.id}?month=${format(currentMonth, 'yyyy-MM')}`)}>
                                        <Eye className="h-4 w-4 text-primary" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : <div className="h-48 flex items-center justify-center font-bold text-muted-foreground opacity-50 uppercase text-xs tracking-widest">Tidak ada data.</div>}
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
        <Card className="w-full">
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

                <TabsContent value="guru"><StaffReportListView data={filteredData} isLoading={isLoading} currentMonth={currentMonth} /></TabsContent>
                <TabsContent value="pegawai"><StaffReportListView data={filteredData} isLoading={isLoading} currentMonth={currentMonth} /></TabsContent>
                <TabsContent value="kepala_sekolah"><StaffReportListView data={filteredData} isLoading={isLoading} currentMonth={currentMonth} /></TabsContent>
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
