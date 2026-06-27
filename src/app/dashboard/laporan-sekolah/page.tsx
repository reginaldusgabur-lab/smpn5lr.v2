
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, query, where, doc } from 'firebase/firestore';
import { format, isValid, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet, Edit, Eye, Search, Filter } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import EditAttendanceModal from '@/components/modals/EditAttendanceModal';
import * as XLSX from 'xlsx';
import { calculateAttendanceStats, fetchUserMonthlyReportData } from '@/lib/attendance';

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
}

const safeFormat = (dateInput: string | Date | null | undefined, formatString: string, options: any = {}) => {
    if (!dateInput) return '-';
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return isValid(date) ? format(date, formatString, options) : '-';
};

export default function SchoolReportPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [reportData, setReportData] = useState<ReportRowData[]>([]);
    const [isReportLoading, setIsReportLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ReportRowData | null>(null);
    const [refetchIndex, setRefetchIndex] = useState(0);

    const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
    const { data: schoolConfigData } = useDoc(user, schoolConfigRef);

    useEffect(() => {
        if (isUserLoading || !user || !firestore) return;
        
        let isMounted = true;
        const loadData = async () => {
            setIsReportLoading(true);
            try {
                const usersQuery = query(collection(firestore, 'users'), where('role', 'in', ['guru', 'pegawai', 'kepala_sekolah']));
                const usersSnapshot = await getDocs(usersQuery);
                
                const reportPromises = usersSnapshot.docs.map(async (userDoc) => {
                    const stats = await calculateAttendanceStats(firestore, userDoc.id, { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
                    const userData = userDoc.data();
                    return {
                        uid: userDoc.id,
                        name: userData.name || '',
                        nip: userData.nip || '-',
                        position: userData.position || '-',
                        role: userData.role || '',
                        sequenceNumber: userData.sequenceNumber || null,
                        totalHadir: stats.totalHadir,
                        totalIzin: stats.totalIzin,
                        totalSakit: stats.totalSakit,
                        totalAlpa: stats.totalAlpa,
                        persentase: stats.persentase,
                    };
                });

                const results = await Promise.all(reportPromises);
                results.sort((a, b) => (a.sequenceNumber ?? 999) - (b.sequenceNumber ?? 999));

                if (isMounted) setReportData(results.map((r, i) => ({ ...r, no: i + 1 })));
            } catch (err) { if (isMounted) setError("Gagal memuat data."); }
            finally { if (isMounted) setIsReportLoading(false); }
        };
        loadData();
        return () => { isMounted = false; };
    }, [user, isUserLoading, firestore, currentMonth, refetchIndex]);

    const filteredReports = useMemo(() => reportData.filter(r => (roleFilter === 'all' || r.role === roleFilter) && r.name.toLowerCase().includes(searchTerm.toLowerCase())), [reportData, roleFilter, searchTerm]);
    const monthName = format(currentMonth, 'MMMM yyyy', { locale: id });

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="px-4 md:px-0">
                    <h1 className="text-3xl font-bold tracking-tight">Laporan Sekolah</h1>
                    <p className="text-muted-foreground mt-1">Ringkasan kehadiran bulanan untuk seluruh personil.</p>
                </div>

                <Card className="overflow-hidden">
                    <CardContent className="p-0 sm:p-6 min-h-[500px]">
                        <div className="p-4 space-y-6">
                            <div className="flex flex-col items-center justify-center gap-4 py-2">
                                <div className="flex items-center gap-4">
                                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                    <span className="w-40 text-center font-bold text-lg">{monthName}</span>
                                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={isSameMonth(currentMonth, new Date())}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                                <div className="w-full h-px bg-border mt-2" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                <div className="md:col-span-4">
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="pl-10 relative"><Filter className="absolute left-3 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Peran" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">Semua Peran</SelectItem><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-5 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Cari nama..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                <div className="md:col-span-3">
                                    <Button className="w-full font-semibold" disabled={isReportLoading || !filteredReports.length}><Download className="mr-2 h-4 w-4" /> Unduh Laporan</Button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="w-[60px] text-center font-bold">No</TableHead>
                                            <TableHead className="font-bold">Nama & NIP</TableHead>
                                            <TableHead className="text-center font-bold">H</TableHead>
                                            <TableHead className="text-center font-bold">I/S</TableHead>
                                            <TableHead className="text-center font-bold">A</TableHead>
                                            <TableHead className="text-center font-bold">%</TableHead>
                                            <TableHead className="w-[80px] text-center font-bold">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(isReportLoading || isUserLoading) ? (
                                            [...Array(10)].map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                                                    <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : filteredReports.map((item) => (
                                            <TableRow key={item.uid} className="hover:bg-muted/20 transition-colors">
                                                <TableCell className="text-center font-medium">{item.no}</TableCell>
                                                <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{item.name}</span><span className="text-xs text-muted-foreground">{item.nip}</span></div></TableCell>
                                                <TableCell className="text-center font-semibold text-green-600">{Math.ceil(item.totalHadir)}</TableCell>
                                                <TableCell className="text-center font-medium text-orange-600">{item.totalIzin + item.totalSakit}</TableCell>
                                                <TableCell className="text-center font-bold text-destructive">{item.totalAlpa}</TableCell>
                                                <TableCell className="text-center font-bold">{item.persentase}</TableCell>
                                                <TableCell className="text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/dashboard/laporan/${item.uid}`}><Eye className="mr-2 h-4 w-4" /> Detail</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> Perbaiki</DropdownMenuItem></DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            {isEditModalOpen && editingUser && <EditAttendanceModal user={editingUser} month={currentMonth} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} currentUser={user} />}
        </div>
    );
}
