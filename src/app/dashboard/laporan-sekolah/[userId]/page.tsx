'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { fetchUserMonthlyReportData } from '@/lib/attendance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths, format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import EditAttendanceModal from '@/components/modals/EditAttendanceModal';

const statusToVariant = {
    Hadir: 'success',
    Sakit: 'warning',
    Izin: 'warning',
    Dinas: 'info',
    Alpa: 'destructive',
    'Pulang Cepat': 'info',
};

export default function UserReportPage({ params }) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [user, setUser] = useState(null);
    const [schoolConfig, setSchoolConfig] = useState(null);
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsUserLoading(true);
            if (firestore && params.userId) {
                const userRef = doc(firestore, 'users', params.userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    setUser({ uid: userSnap.id, ...userSnap.data() });
                }
                const configRef = doc(firestore, 'schoolConfig', 'default');
                const configSnap = await getDoc(configRef);
                if (configSnap.exists()) {
                    setSchoolConfig(configSnap.data());
                }
            }
            setIsUserLoading(false);
        };
        fetchInitialData();
    }, [firestore, params.userId]);

    const { data: reportData, isLoading: isReportLoading, error, mutate } = useSWR(
        user && schoolConfig ? `report_${user.uid}_${format(currentMonth, 'yyyy-MM')}` : null,
        () => fetchUserMonthlyReportData(firestore, user.uid, currentMonth, schoolConfig)
    );

    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleOpenModal = () => setIsModalOpen(true);
    const handleModalClose = () => {
        setIsModalOpen(false);
        mutate(); // Re-fetch data when modal is closed
    };

    const isLoading = isUserLoading || isReportLoading;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Laporan Detail Kehadiran</CardTitle>
                        {user ? (
                            <CardDescription className="pt-2">Nama: {user.name}</CardDescription>
                        ) : (
                            <Skeleton className="h-5 w-48 mt-2" />
                        )}
                    </div>
                    {currentUser && currentUser.role === 'admin' && (
                        <Button onClick={handleOpenModal} variant="outline">Perbaiki Kehadiran</Button>
                    )}
                </div>
                <div className="flex items-center justify-between pt-4">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Masuk</TableHead>
                                <TableHead>Pulang</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Keterangan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    </TableRow>
                                ))
                            ) : error ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Gagal memuat data.</TableCell></TableRow>
                            ) : reportData && reportData.length > 0 ? (
                                reportData.map((item) => {
                                    const itemDate = parseISO(item.date);
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{format(itemDate, 'eeee, dd MMM yyyy', { locale: id })}</TableCell>
                                            <TableCell>{item.checkInTime ? format(parseISO(item.checkInTime), 'HH:mm:ss') : '-'}</TableCell>
                                            <TableCell>{item.checkOutTime ? format(parseISO(item.checkOutTime), 'HH:mm:ss') : '-'}</TableCell>
                                            <TableCell><Badge variant={statusToVariant[item.status] || 'default'}>{item.status}</Badge></TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {item.description}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">Tidak ada data untuk bulan ini.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {user && schoolConfig && currentUser && (
                <EditAttendanceModal 
                    user={user} 
                    month={currentMonth} 
                    isOpen={isModalOpen} 
                    onClose={handleModalClose} 
                    currentUser={currentUser}
                />
            )}
        </Card>
    );
}