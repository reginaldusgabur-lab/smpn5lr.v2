'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { DataTable } from '@/components/data-table';
import { columns as createColumns } from './columns';
import { Loader2, AlertCircle, Inbox, ShieldAlert, Check, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const approvalStatusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'approved': 'default',
    'pending': 'outline',
    'rejected': 'destructive',
};

const ApprovalTableSkeleton = ({ cols = 5 }: { cols?: number }) => (
    <div className="rounded-md border border-muted-foreground/10">
        <Table>
            <TableHeader>
                <TableRow>
                    {[...Array(cols)].map((_, i) => (
                        <TableHead key={i}><Skeleton className="h-4 w-full" /></TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        {[...Array(cols)].map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

export default function IzinKepalaSekolahPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaveRequests = async () => {
        if (!user || user.role !== 'kepala_sekolah' || !firestore) return;
        
        setIsLoadingData(true);
        setError(null);
        try {
            const usersQuery = query(collection(firestore, 'users'), where('role', 'in', ['guru', 'pegawai']));
            const usersSnapshot = await getDocs(usersQuery);

            if (usersSnapshot.empty) {
                setAllRequests([]);
                setIsLoadingData(false);
                return;
            }

            const sixDaysAgo = new Date();
            sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
            sixDaysAgo.setHours(0, 0, 0, 0);

            const fetchedRequests: any[] = [];

            const promises = usersSnapshot.docs.map(async (userDoc) => {
                const userData = userDoc.data();
                const userId = userDoc.id;

                const leaveRequestsQuery = query(collection(firestore, 'users', userId, 'leaveRequests'));
                const leaveRequestsSnapshot = await getDocs(leaveRequestsQuery);
                
                leaveRequestsSnapshot.forEach(doc => {
                    const data = doc.data();
                    const startDate = data.startDate?.toDate();
                    
                    // Ambil yang pending ATAU yang diproses dalam 6 hari terakhir
                    if (data.status === 'pending' || (startDate && startDate >= sixDaysAgo)) {
                        fetchedRequests.push({
                            id: doc.id,
                            path: doc.ref.path,
                            userId: userId,
                            userName: userData.name || 'Nama tidak ada',
                            ...data
                        });
                    }
                });
            });

            await Promise.all(promises);
            setAllRequests(fetchedRequests);
        } catch (err: any) {
            console.error("Error fetching leave requests:", err);
            setError(`Gagal mengambil data permintaan izin.`);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        if (!isUserLoading && user?.role === 'kepala_sekolah') {
            fetchLeaveRequests();
        } else if (!isUserLoading) {
            setIsLoadingData(false);
        }
    }, [user, isUserLoading, firestore]);

    const { pendingRequests, recentHistory } = useMemo(() => {
        const pending = allRequests.filter(r => r.status === 'pending')
            .sort((a, b) => (b.startDate?.toDate().getTime() || 0) - (a.startDate?.toDate().getTime() || 0));
        
        const history = allRequests.filter(r => r.status !== 'pending')
            .sort((a, b) => (b.startDate?.toDate().getTime() || 0) - (a.startDate?.toDate().getTime() || 0));
            
        return { pendingRequests: pending, recentHistory: history };
    }, [allRequests]);

    const handleUpdateRequest = async (path: string, status: 'approved' | 'rejected') => {
        if (!user || !firestore) return;
        try {
            const requestDocRef = doc(firestore, path);
            await updateDoc(requestDocRef, { 
                status,
                approvedBy: user.uid,
                approvedAt: Timestamp.now()
            });
            
            // Refresh data setelah update
            fetchLeaveRequests();
        } catch (err) {
            console.error("Error updating request: ", err);
        }
    };

    const handleColumns = useMemo(() => createColumns(handleUpdateRequest), [firestore, user]);

    if (!isUserLoading && user && user.role !== 'kepala_sekolah') {
        return (
            <div className="flex-1 pt-4 pb-24 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <Alert variant="destructive" className="rounded-3xl border-none">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle className="font-bold">Akses ditolak</AlertTitle>
                        <AlertDescription className="font-bold">Halaman ini hanya dapat diakses oleh Kepala Sekolah.</AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <div className="px-4 md:px-0">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Persetujuan izin</h1>
                    <p className="text-muted-foreground mt-1 font-bold">Tinjau dan proses permintaan izin atau sakit.</p>
                </div>

                {/* KARTU 1: PERMINTAAN TERTUNDA */}
                <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-3xl bg-card">
                    <CardHeader className="p-6 border-b border-muted-foreground/10 text-primary">
                        <CardTitle className="font-bold text-sm tracking-tight">Permintaan izin tertunda</CardTitle>
                        <CardDescription className="text-muted-foreground font-bold pt-1">Daftar permintaan izin atau sakit yang sedang menunggu persetujuan Kepala Sekolah.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 min-h-[200px]">
                        {error ? (
                            <div className="p-8 text-center">
                                <Alert variant="destructive" className="rounded-2xl border-none">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="font-bold">Error</AlertTitle>
                                    <AlertDescription className="font-bold">{error}</AlertDescription>
                                </Alert>
                            </div>
                        ) : (isLoadingData || isUserLoading) ? (
                            <div className="p-4 sm:p-0">
                                <ApprovalTableSkeleton />
                            </div>
                        ) : pendingRequests.length > 0 ? (
                            <div className="p-4 sm:p-0">
                                <DataTable columns={handleColumns} data={pendingRequests} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center py-20 px-4 text-muted-foreground">
                                <Inbox className="h-12 w-12 mb-4 opacity-20" />
                                <h3 className="text-lg font-bold text-foreground">Tidak ada permintaan tertunda</h3>
                                <p className="text-xs font-bold">Semua permintaan izin dan sakit telah diproses.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* KARTU 2: RIWAYAT PERSETUJUAN */}
                <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-3xl bg-card">
                    <CardHeader className="p-6 border-b border-muted-foreground/10 text-primary">
                        <CardTitle className="font-bold text-sm tracking-tight">Riwayat persetujuan</CardTitle>
                        <CardDescription className="text-muted-foreground font-bold pt-1">Riwayat permintaan izin atau sakit yang telah diproses dalam 6 hari terakhir.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        {isLoadingData ? (
                            <div className="p-4 sm:p-0">
                                <ApprovalTableSkeleton cols={5} />
                            </div>
                        ) : recentHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
                                <p className="text-xs font-bold">Tidak ada riwayat persetujuan dalam 6 hari terakhir.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-none">
                                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Nama Pengguna</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Jenis</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Tanggal</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Alasan</TableHead>
                                            <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-primary/80">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentHistory.map(req => (
                                            <TableRow key={req.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                                <TableCell className="font-bold text-sm text-foreground">{req.userName}</TableCell>
                                                <TableCell>
                                                    <Badge variant={req.type === 'Sakit' ? 'destructive' : 'secondary'} className="text-[9px] font-bold uppercase px-3 py-0.5">
                                                        {req.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                                    {req.startDate?.toDate ? format(req.startDate.toDate(), 'd MMM yyyy', { locale: id }) : ''}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-[11px] font-medium" title={req.reason}>
                                                    {req.reason}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={approvalStatusVariant[req.status] || 'secondary'} className="text-[9px] font-bold uppercase px-3 py-0.5">
                                                        {req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : req.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
