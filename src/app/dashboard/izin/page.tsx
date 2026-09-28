
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser, useDoc, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, query, where, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, MessageSquare, MailCheck, Clock, CheckCircle2, Calendar, Info } from 'lucide-react';
import { startOfDay, endOfDay, addDays, format, parse, isValid } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAttendanceWindow } from '@/hooks/use-attendance-window';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const leaveRequestSchema = z.object({
  leaveDate: z.enum(['today', 'tomorrow', 'range'], {
    required_error: 'Tanggal pengajuan wajib dipilih.',
  }),
  type: z.string({
    required_error: 'Jenis pengajuan wajib dipilih.',
  }),
  reason: z.string().min(5, { message: 'Alasan terlalu singkat.' }),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default function IzinPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const { status: windowStatus, config: schoolConfig, monthlyConfig } = useAttendanceWindow();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
    const { data: userData } = useDoc(user, userDocRef);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const form = useForm<z.infer<typeof leaveRequestSchema>>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            leaveDate: 'today',
            type: undefined,
            reason: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
        }
    });

    const watchedType = form.watch('type');
    const isCutiSelected = watchedType === 'Cuti Resmi';

    useEffect(() => {
        if (isCutiSelected) {
            form.setValue('leaveDate', 'range');
        }
    }, [isCutiSelected, form]);

    const { today, tomorrow } = useMemo(() => {
        const t = startOfDay(currentTime);
        const tom = addDays(t, 1);
        return { today: t, tomorrow: tom };
    }, [currentTime]);

    const isDateHoliday = useCallback((date: Date) => {
        if (!schoolConfig) return false;
        const dayOfWeek = date.getDay();
        const offDays = schoolConfig.offDays ?? [0, 6];
        const isRecurringOff = offDays.includes(dayOfWeek);
        const dateStr = format(date, 'yyyy-MM-dd');
        const isSpecificHoliday = (monthlyConfig as any)?.holidays?.includes(dateStr);
        return isRecurringOff || isSpecificHoliday || schoolConfig.isAttendanceActive === false;
    }, [schoolConfig, monthlyConfig]);

    const isTodayLocked = useMemo(() => {
        return windowStatus === 'CLOSED' || windowStatus === 'SESSION_INACTIVE' || windowStatus === 'DISABLED' || isDateHoliday(today);
    }, [windowStatus, isDateHoliday, today]);

    const isTomorrowLocked = useMemo(() => isDateHoliday(tomorrow), [isDateHoliday, tomorrow]);

    const attendanceQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', format(today, 'yyyy-MM-dd')));
    }, [user?.uid, firestore, today]);
    const { data: todayAttendance } = useCollection(user, attendanceQuery);
    
    const hasCheckedIn = !!(todayAttendance && todayAttendance[0]?.checkInTime);
    const hasCheckedOut = !!(todayAttendance && todayAttendance[0]?.checkOutTime);

    const onSubmit = async (values: z.infer<typeof leaveRequestSchema>) => {
        if (!user || !firestore) return;
        setIsSubmitting(true);

        let finalStart, finalEnd;
        if (values.leaveDate === 'today') {
            finalStart = startOfDay(today);
            finalEnd = endOfDay(today);
        } else if (values.leaveDate === 'tomorrow') {
            finalStart = startOfDay(tomorrow);
            finalEnd = endOfDay(tomorrow);
        } else {
            finalStart = startOfDay(parse(values.startDate!, 'yyyy-MM-dd', new Date()));
            finalEnd = endOfDay(parse(values.endDate!, 'yyyy-MM-dd', new Date()));
        }

        if (!isValid(finalStart) || !isValid(finalEnd)) {
            toast({ variant: 'destructive', title: 'Tanggal tidak valid' });
            setIsSubmitting(false);
            return;
        }

        const dataToSave = {
            userId: user.uid, 
            userName: userData?.name || user.displayName,
            type: values.type,
            startDate: Timestamp.fromDate(finalStart),
            endDate: Timestamp.fromDate(finalEnd),
            reason: values.reason, 
            status: 'pending', 
            createdAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(firestore, 'users', user.uid, 'leaveRequests'), dataToSave);
            toast({ title: 'Terkirim', description: 'Pengajuan Anda telah dikirim.' });
            form.reset();
            invalidateCache();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: error.message });
        } finally { setIsSubmitting(false); }
    };

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><MailCheck className="w-24 h-24 text-white" /></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm"><MailCheck className="h-6 w-6" /></div>
                            <div className="space-y-0.5"><h2 className="font-bold text-2xl tracking-tight leading-tight">Pengajuan Izin & Cuti</h2><p className="text-[11px] font-medium text-white/80 leading-relaxed">Formulir resmi ketidakhadiran personil.</p></div>
                        </div>
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardHeader className="p-6 border-b border-muted-foreground/5 bg-muted/20">
                                <CardTitle className="text-blue-600 font-bold text-sm uppercase tracking-widest">Informasi Pengajuan</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-muted-foreground">Silakan lengkapi detail ketidakhadiran Anda.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="type" render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Jenis Pengajuan</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold"><SelectValue placeholder="Pilih jenis" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                                    <SelectItem value="Sakit" className="font-bold">Sakit</SelectItem>
                                                    <SelectItem value="Izin Pribadi" className="font-bold">Izin Pribadi</SelectItem>
                                                    <SelectItem value="Dinas Pagi" className="font-bold">Tugas Dinas Pagi</SelectItem>
                                                    <SelectItem value="Dinas Siang" className="font-bold" disabled={!hasCheckedIn}>Tugas Dinas Siang</SelectItem>
                                                    <SelectItem value="Kegiatan Luar Sekolah" className="font-bold">Kegiatan Luar Sekolah</SelectItem>
                                                    <SelectItem value="Terlambat" className="font-bold" disabled={hasCheckedIn}>Izin Terlambat</SelectItem>
                                                    <SelectItem value="Pulang Cepat" className="font-bold" disabled={!hasCheckedIn || hasCheckedOut}>Izin Pulang Cepat</SelectItem>
                                                    {userData?.status === 'Cuti' && (
                                                        <SelectItem value="Cuti Resmi" className="font-bold text-primary italic">Cuti Resmi (Hari Libur)</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="leaveDate" render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pilih Sesi/Waktu</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={isCutiSelected}>
                                                <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                                    <SelectItem value="today" disabled={isTodayLocked} className="font-bold">Hari Ini</SelectItem>
                                                    <SelectItem value="tomorrow" disabled={isTomorrowLocked} className="font-bold">Besok</SelectItem>
                                                    <SelectItem value="range" className="font-bold">Rentang Tanggal (Kustom)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                </div>

                                {(form.watch('leaveDate') === 'range' || isCutiSelected) && (
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-500">
                                        <FormField control={form.control} name="startDate" render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[9px] font-black uppercase text-primary">Tanggal Mulai</FormLabel>
                                                <FormControl><Input type="date" {...field} className="h-10 rounded-xl bg-background border-primary/20 font-bold" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="endDate" render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[9px] font-black uppercase text-primary">Tanggal Selesai</FormLabel>
                                                <FormControl><Input type="date" {...field} className="h-10 rounded-xl bg-background border-primary/20 font-bold" /></FormControl>
                                            </FormItem>
                                        )} />
                                    </div>
                                )}

                                <FormField control={form.control} name="reason" render={({ field }) => (
                                    <FormItem className="space-y-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Alasan Detail</FormLabel><FormControl><Textarea placeholder="Tuliskan alasan pengajuan Anda secara ringkas..." {...field} className="min-h-[120px] rounded-xl bg-muted/30 border-muted-foreground/10 transition-all font-bold text-sm shadow-none" /></FormControl><FormMessage className="text-[10px] font-bold" /></FormItem>
                                )} />
                                
                                <div className="space-y-3">
                                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start gap-3">
                                        <MessageSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold text-slate-600 leading-relaxed">
                                            <span className="text-blue-600 uppercase tracking-widest mr-1">Petunjuk:</span>
                                            Isi dengan alasan singkat saja. Kalimat sapaan lengkap harap dikirim langsung kepada <span className="text-foreground">Kepala Sekolah melalui WhatsApp atau menyesuaikan aturan sekolah.</span>
                                        </p>
                                    </div>

                                    {isCutiSelected && (
                                        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-3 animate-in zoom-in-95 duration-300">
                                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                                                <span className="uppercase tracking-widest mr-1">Petunjuk Pengajuan Cuti:</span>
                                                Pengajuan <span className="italic">Cuti Resmi</span> akan dihitung sebagai hari libur pribadi dan tidak memengaruhi poin kehadiran. Pastikan rentang tanggal sudah benar sesuai surat izin yang ada.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="p-6 border-t border-muted-foreground/5 bg-muted/5">
                                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-black bg-primary uppercase tracking-[0.2em] shadow-lg shadow-primary/20 text-[11px] active:scale-95 transition-all">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Pengajuan Sekarang"}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
            </div>
        </div>
    );
}
