'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, query, where, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, MessageSquare, AlertCircle, Sparkles, CalendarDays, Clock } from 'lucide-react';
import { startOfDay, endOfDay, addDays, format } from 'date-fns';
import { id as indonesiaLocale } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
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
  leaveDate: z.enum(['today', 'tomorrow'], {
    required_error: 'Tanggal pengajuan wajib dipilih.',
  }),
  type: z.string({
    required_error: 'Jenis pengajuan wajib dipilih.',
  }),
  reason: z.string().min(5, { message: 'Alasan terlalu singkat.' }),
  proofUrl: z.string().optional().or(z.literal('')),
});

export default function IzinPage() {
    const form = useForm<z.infer<typeof leaveRequestSchema>>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            leaveDate: 'today',
            type: undefined,
            reason: '',
            proofUrl: '',
        }
    });
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timerId);
    }, []);

    const { today, tomorrow, currentMonthId } = useMemo(() => {
        const t = startOfDay(currentTime);
        const tom = addDays(t, 1);
        return {
            today: t,
            tomorrow: tom,
            currentMonthId: format(t, 'yyyy-MM'),
        };
    }, [currentTime]);

    const schoolConfigRef = useMemoFirebase(() => user ? doc(firestore, 'schoolConfig', 'default') : null, [firestore, user]);
    const { data: schoolConfig } = useDoc(user, schoolConfigRef);

    const selectedDateValue = form.watch('leaveDate');
    const targetDate = useMemo(() => selectedDateValue === 'tomorrow' ? tomorrow : today, [selectedDateValue, today, tomorrow]);
    const targetDateStart = useMemo(() => startOfDay(targetDate), [targetDate]);

    const attendanceQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'users', user.uid, 'attendanceRecords'),
            where('date', '==', format(targetDate, 'yyyy-MM-dd'))
        );
    }, [user, firestore, targetDate]);
    const { data: targetDateAttendance } = useCollection(user, attendanceQuery);
    
    const existingLeaveQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'users', user.uid, 'leaveRequests'),
            where('startDate', '==', Timestamp.fromDate(targetDateStart))
        );
    }, [user, firestore, targetDateStart]);
    const { data: existingLeaves } = useCollection(user, existingLeaveQuery);
    const currentDayLeave = existingLeaves?.[0];

    const onSubmit = async (values: z.infer<typeof leaveRequestSchema>) => {
        if (!user || !firestore) return;
        setIsSubmitting(true);

        const dataToSave = {
            userId: user.uid,
            type: values.type,
            startDate: Timestamp.fromDate(startOfDay(targetDate)),
            endDate: Timestamp.fromDate(endOfDay(targetDate)),
            reason: values.reason,
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(firestore, 'users', user.uid, 'leaveRequests'), dataToSave);
            toast({ title: 'Terkirim', description: 'Pengajuan Anda telah dikirim.' });
            form.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelLeave = async () => {
        if (!user || !firestore || !currentDayLeave) return;
        setIsCancelling(true);
        try {
            await deleteDoc(doc(firestore, 'users', user.uid, 'leaveRequests', currentDayLeave.id));
            toast({ title: 'Dibatalkan', description: 'Pengajuan telah dihapus.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: error.message });
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="px-4 md:px-0">
                    <h1 className="text-2xl font-normal tracking-tight text-foreground">Formulir pengajuan izin</h1>
                    <p className="text-sm font-bold text-muted-foreground mt-0.5">Isi detail untuk permohonan ketidakhadiran.</p>
                </div>

                <Card className="border border-muted-foreground/10 shadow-none rounded-xl overflow-hidden bg-card">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardHeader className="p-6 border-b border-muted-foreground/5 bg-white dark:bg-slate-900/20">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-blue-600 dark:text-blue-400 font-bold text-base tracking-tight">Data Permohonan</CardTitle>
                                        <CardDescription className="text-muted-foreground font-medium text-xs">Pastikan informasi yang diberikan sudah benar.</CardDescription>
                                    </div>
                                    {currentDayLeave && (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 font-bold px-3 py-1">
                                            {currentDayLeave.status === 'pending' ? 'Menunggu' : currentDayLeave.status}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            
                            <CardContent className="p-8 space-y-8 bg-white dark:bg-slate-900/20">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormField
                                        control={form.control}
                                        name="leaveDate"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pilih Tanggal</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-muted-foreground/10 shadow-none font-bold text-sm">
                                                            <SelectValue placeholder="Pilih tanggal" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                                        <SelectItem value="today" className="rounded-lg font-bold">Hari Ini</SelectItem>
                                                        <SelectItem value="tomorrow" className="rounded-lg font-bold">Besok</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jenis Pengajuan</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-muted-foreground/10 shadow-none font-bold text-sm">
                                                            <SelectValue placeholder="Pilih jenis" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                                        <SelectItem value="Sakit" className="rounded-lg font-bold">Sakit</SelectItem>
                                                        <SelectItem value="Izin Pribadi" className="rounded-lg font-bold">Izin Pribadi</SelectItem>
                                                        <SelectItem value="Dinas" className="rounded-lg font-bold">Perjalanan Dinas</SelectItem>
                                                        <SelectItem value="Terlambat" className="rounded-lg font-bold">Izin Terlambat</SelectItem>
                                                        <SelectItem value="Pulang Cepat" className="rounded-lg font-bold">Izin Pulang Cepat</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="reason"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alasan</FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                    placeholder="Pilih jenis izin terlebih dahulu..." 
                                                    {...field} 
                                                    className="min-h-[140px] rounded-xl bg-slate-50 dark:bg-slate-900/50 border-muted-foreground/10 focus:bg-white dark:focus:bg-slate-900 transition-all font-bold text-sm shadow-none" 
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />

                                <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 border border-dashed border-blue-200/50 dark:border-blue-800/50 rounded-xl flex items-start gap-3">
                                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                        <span className="text-blue-600 dark:text-blue-400 uppercase tracking-widest mr-1">Petunjuk:</span>
                                        Isi dengan alasan singkat saja (misal: Sakit demam). Kalimat sapaan atau permohonan izin lengkap harap dikirim langsung kepada <span className="text-slate-900 dark:text-slate-200">Kepala Sekolah melalui WhatsApp atau menyesuaikan aturan sekolah.</span>
                                    </p>
                                </div>
                            </CardContent>

                            <CardFooter className="p-6 border-t border-muted-foreground/5 bg-slate-50/50 dark:bg-slate-900/40">
                                <div className="flex items-center justify-between w-full">
                                    <Button 
                                        type="submit" 
                                        disabled={isSubmitting || !!currentDayLeave}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-black tracking-widest text-[11px] h-12 px-8 rounded-xl shadow-lg shadow-blue-600/20 uppercase"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Pengajuan"}
                                    </Button>

                                    {currentDayLeave && currentDayLeave.status === 'pending' && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button type="button" variant="ghost" className="text-red-500 font-bold text-[10px] uppercase hover:bg-red-50">
                                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Batalkan
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-2xl border-none shadow-none">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-bold text-lg">Batalkan pengajuan?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-sm font-medium">Pengajuan izin Anda akan dihapus secara permanen.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="rounded-xl font-bold shadow-none">Kembali</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleCancelLeave} className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold border-none shadow-none">Ya, Hapus</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
            </div>
        </div>
    );
}
