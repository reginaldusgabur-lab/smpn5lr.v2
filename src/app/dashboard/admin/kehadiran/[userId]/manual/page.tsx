
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, addDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parse, format, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const getRandomTime = (baseDate: Date, startTimeStr: string, endTimeStr: string): Date => {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const startDate = new Date(baseDate.getTime());
    startDate.setHours(startH, startM, 0, 0);
    const endDate = new Date(baseDate.getTime());
    endDate.setHours(endH, endM, 0, 0);
    const randomTimestamp = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const res = new Date(randomTimestamp);
    res.setSeconds(Math.floor(Math.random() * 60));
    return res;
};

export default function ManualAttendancePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { user: authUser, isUserLoading: isAuthLoading } = useUser();
    const { toast } = useToast();

    const userId = params.userId as string;
    const dateStr = searchParams.get('date');

    const [userData, setUserData] = useState<any>(null);
    const [schoolConfig, setSchoolConfig] = useState<any>(null);
    const [existingRecord, setExistingRecord] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [error, setError] = useState<string | null>(null);

    const date = dateStr ? parse(dateStr, 'yyyy-MM-dd', new Date()) : startOfDay(new Date());

    useEffect(() => {
        const checkAuthAndFetchData = async () => {
            if (isAuthLoading) return;
            if (!authUser) {
                router.replace('/');
                return;
            }

            try {
                const adminDocRef = doc(firestore, 'users', authUser.uid);
                const adminDocSnap = await getDoc(adminDocRef);
                if (!adminDocSnap.exists() || adminDocSnap.data().role !== 'admin') {
                    router.replace('/dashboard');
                    return;
                }

                const userDocRef = doc(firestore, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setUserData(userDocSnap.data());
                } else {
                    setError('Pengguna tidak ditemukan.');
                    setIsLoading(false);
                    return;
                }

                const schoolConfigRef = doc(firestore, 'schoolConfig', 'default');
                const schoolConfigSnap = await getDoc(schoolConfigRef);
                if (schoolConfigSnap.exists()) {
                    setSchoolConfig(schoolConfigSnap.data());
                }

                const attendanceRef = collection(firestore, 'users', userId, 'attendanceRecords');
                const q = query(attendanceRef, 
                    where('date', '==', format(date, 'yyyy-MM-dd'))
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const record = querySnapshot.docs[0].data();
                    const recordId = querySnapshot.docs[0].id;
                    setExistingRecord({ ...record, id: recordId });
                    if (record.checkInTime) {
                        setCheckIn(format(record.checkInTime.toDate(), 'HH:mm'));
                    }
                    if (record.checkOutTime) {
                        setCheckOut(format(record.checkOutTime.toDate(), 'HH:mm'));
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Gagal memuat data.');
            } finally {
                setIsLoading(false);
            }
        };
        checkAuthAndFetchData();
    }, [authUser, isAuthLoading, firestore, userId, date, router]);

    const handleSetLate = () => {
        if (schoolConfig?.checkInEndTime) {
            setCheckIn(schoolConfig.checkInEndTime);
            toast({ title: 'Sukses', description: 'Jam masuk diatur ke batas akhir, silakan simpan.' });
        } else {
            setError('Konfigurasi jam masuk belum diatur.');
        }
    };

    const handleSetHadir = async () => {
        if (!schoolConfig || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const recordDate = startOfDay(date);
            const inStart = schoolConfig.checkInStartTime || '07:00';
            const inEnd = schoolConfig.checkInEndTime || '07:30';
            const outStart = schoolConfig.checkOutStartTime || '14:00';
            const outEnd = schoolConfig.checkOutEndTime || '15:00';

            const checkInTime = getRandomTime(recordDate, inStart, inEnd);
            const checkOutTime = getRandomTime(recordDate, outStart, outEnd);

            const attendanceData = {
                userId,
                date: format(date, 'yyyy-MM-dd'),
                checkInTime: Timestamp.fromDate(checkInTime),
                checkOutTime: Timestamp.fromDate(checkOutTime),
                manualEntry: true,
                reasonForUpdate: 'Kehadiran Penuh',
                lastModifiedBy: authUser?.uid,
                lastModifiedAt: serverTimestamp()
            };

            if (existingRecord) {
                const recordRef = doc(firestore, 'users', userId, 'attendanceRecords', existingRecord.id);
                await updateDoc(recordRef, attendanceData);
            } else {
                const attendanceRef = collection(firestore, 'users', userId, 'attendanceRecords');
                await addDoc(attendanceRef, { ...attendanceData, createdAt: serverTimestamp(), createdBy: authUser?.uid });
            }
            toast({ title: 'Sukses', description: `Status Hadir penuh telah disimpan untuk ${userData.name}.` });
            router.back();
        } catch (err) {
            setError('Gagal memproses kehadiran otomatis.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateLeave = async (type: 'Sakit' | 'Izin' | 'Dinas', reason: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const batch = writeBatch(firestore);

            const attendanceRef = collection(firestore, 'users', userId, 'attendanceRecords');
            const q = query(attendanceRef, where('date', '==', format(date, 'yyyy-MM-dd')));
            const attendanceSnapshot = await getDocs(q);
            if (!attendanceSnapshot.empty) {
                const recordToDelete = doc(firestore, 'users', userId, 'attendanceRecords', attendanceSnapshot.docs[0].id);
                batch.delete(recordToDelete);
            }

            const leaveRef = collection(firestore, 'users', userId, 'leaveRequests');
            const newLeaveDoc = doc(leaveRef);
            batch.set(newLeaveDoc, {
                userId,
                type,
                status: 'approved',
                reason,
                startDate: Timestamp.fromDate(startOfDay(date)),
                endDate: Timestamp.fromDate(endOfDay(date)),
                createdAt: serverTimestamp(),
                approvedBy: authUser?.uid,
                approvedAt: serverTimestamp(),
                createdBy: authUser?.uid,
            });

            await batch.commit();
            toast({ title: 'Sukses', description: `Kehadiran untuk ${userData.name} telah diubah menjadi ${reason}.` });
            router.back();

        } catch (err) {
            console.error("Error creating leave:", err);
            setError('Gagal menyimpan perubahan. Silakan coba lagi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkIn && !checkOut) {
            setError('Setidaknya jam masuk atau jam pulang harus diisi.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const [inHours, inMinutes] = checkIn ? checkIn.split(':').map(Number) : [null, null];
            const [outHours, outMinutes] = checkOut ? checkOut.split(':').map(Number) : [null, null];

            const checkInTimestamp = inHours !== null && inMinutes !== null ? Timestamp.fromDate(new Date(new Date(date).setHours(inHours, inMinutes, 0))) : null;
            const checkOutTimestamp = outHours !== null && outMinutes !== null ? Timestamp.fromDate(new Date(new Date(date).setHours(outHours, outMinutes, 0))) : null;
            
            const attendanceData = {
                userId,
                date: format(date, 'yyyy-MM-dd'),
                checkInTime: checkInTimestamp,
                checkOutTime: checkOutTimestamp,
                manualEntry: true,
                lastModifiedBy: authUser?.uid,
                lastModifiedAt: serverTimestamp()
            };

            if (existingRecord) {
                const recordRef = doc(firestore, 'users', userId, 'attendanceRecords', existingRecord.id);
                await updateDoc(recordRef, attendanceData);
            } else {
                const attendanceRef = collection(firestore, 'users', userId, 'attendanceRecords');
                await addDoc(attendanceRef, { ...attendanceData, createdAt: serverTimestamp(), createdBy: authUser?.uid });
            }
            toast({ title: 'Sukses', description: `Kehadiran untuk ${userData.name} telah disimpan.` });
            router.back();
        } catch (err) {
            console.error("Error submitting attendance:", err);
            setError('Gagal menyimpan perubahan. Silakan coba lagi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto p-4">
             <Button variant="outline" size="icon" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Entri Kehadiran Manual</CardTitle>
                    {userData && (
                        <CardDescription>
                            Ubah kehadiran untuk <span className="font-semibold">{userData.name}</span> pada <span className="font-semibold">{format(date, 'EEEE, dd MMMM yyyy', { locale: id })}</span>.
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    {error && <p className="text-red-500 mb-4 text-sm font-semibold text-center">{error}</p>}
                    <div className="space-y-4 mb-6 pt-2">
                        <Label>Tindakan Cepat</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <Button variant="default" size="sm" onClick={handleSetHadir} disabled={isSubmitting}>Jadikan Hadir</Button>
                            <Button variant="outline" size="sm" onClick={handleSetLate} disabled={isSubmitting}>Jadikan Terlambat</Button>
                            <Button variant="outline" size="sm" onClick={() => handleCreateLeave('Sakit', 'Sakit')} disabled={isSubmitting}>Jadikan Sakit</Button>
                            <Button variant="outline" size="sm" onClick={() => handleCreateLeave('Izin', 'Izin Pribadi')} disabled={isSubmitting}>Jadikan Izin</Button>
                            <Button variant="outline" size="sm" onClick={() => handleCreateLeave('Dinas', 'Dinas Pagi')} disabled={isSubmitting}>Dinas Pagi</Button>
                            <Button variant="outline" size="sm" onClick={() => handleCreateLeave('Dinas', 'Dinas Siang')} disabled={isSubmitting}>Dinas Siang</Button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 border-t pt-6">
                         <Label>Entri Jam Manual</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="checkIn">Jam Masuk</Label>
                                <Input id="checkIn" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="checkOut">Jam Pulang</Label>
                                <Input id="checkOut" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                            </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                           Atur jam secara manual dan klik simpan. Mengisi jam akan menimpa status izin/sakit/dinas.
                        </p>
                        
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Simpan Jam Kehadiran
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
