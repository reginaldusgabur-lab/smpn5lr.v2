'use client';

import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ChevronLeft, ChevronRight, CalendarRange, Plus, Trash2, Info, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const daysOfWeek = [
    { value: 0, label: 'Minggu' }, { value: 1, label: 'Senin' }, { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' }, { value: 4, label: 'Kamis' }, { value: 5, label: 'Jumat' }, { value: 6, label: 'Sabtu' },
];

function MonthlyConfigCalendar({ user, schoolConfig }: { user: any, schoolConfig: any }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [isHolidayNotesActive, setIsHolidayNotesActive] = useState(false);
  const [holidayNotes, setHolidayNotes] = useState<{id: string, date: string, content: string, isRed: boolean}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const monthlyConfigId = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
  
  const monthlyConfigRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'monthlyConfigs', monthlyConfigId);
  }, [user?.uid, firestore, monthlyConfigId]);
  
  const { data: monthlyConfigData, isLoading: isMonthlyConfigLoading } = useDoc(user, monthlyConfigRef);
  
  const allDaysInMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0) }), [currentMonth]);

  useEffect(() => {
    if (monthlyConfigData) {
      setHolidays((monthlyConfigData.holidays ?? []).map((d: string) => new Date(`${d}T00:00:00`)));
      setAcademicYear(monthlyConfigData.academicYear || schoolConfig?.academicYear || '');
      setIsHolidayNotesActive(monthlyConfigData.isHolidayNotesActive ?? false);
      setHolidayNotes(monthlyConfigData.holidayNotes || []);
    } else {
      setHolidays([]); setAcademicYear(schoolConfig?.academicYear || ''); setIsHolidayNotesActive(false); setHolidayNotes([]);
    }
  }, [monthlyConfigData, schoolConfig?.academicYear]);

  const calculatedWorkDays = useMemo(() => {
    if (!schoolConfig) return 0;
    const recurringOffDays: number[] = schoolConfig.offDays ?? [0, 6];
    const specificHolidays = new Set(holidays.map(d => format(d, 'yyyy-MM-dd')));
    return allDaysInMonth.filter(day => !recurringOffDays.includes(day.getDay()) && !specificHolidays.has(format(day, 'yyyy-MM-dd'))).length;
  }, [allDaysInMonth, holidays, schoolConfig?.offDays]);

  const handleSave = async () => {
    if (!user || !monthlyConfigRef) return;
    setIsSaving(true);
    try {
      await setDoc(monthlyConfigRef, { id: monthlyConfigId, holidays: holidays.map(d => format(d, 'yyyy-MM-dd')), manualWorkDays: calculatedWorkDays, academicYear, isHolidayNotesActive, holidayNotes: holidayNotes.filter(n => n.date.trim() !== '' || n.content.trim() !== '') }, { merge: true });
      toast({ title: 'Berhasil', description: 'Pengaturan bulanan disimpan.' });
    } catch (e) { toast({ variant: 'destructive', title: 'Gagal' }); }
    finally { setIsSaving(false); }
  };

  const updateNote = (id: string, field: string, value: any) => setHolidayNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
  
  return (
    <Card className="lg:col-span-3 border-none shadow-none rounded-2xl bg-card">
        <CardHeader className="p-6 border-b border-muted-foreground/10 text-primary">
            <CardTitle className="font-bold text-sm uppercase tracking-widest">Kalender Kerja & Hari Libur</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">Tentukan hari libur spesifik dan tahun ajaran untuk bulan ini.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6">
            <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-2xl">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}><ChevronLeft /></Button>
                    <span className="font-black text-sm uppercase tracking-tight">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}><ChevronRight /></Button>
                </div>
                <ScrollArea className="h-[500px] rounded-2xl border bg-muted/5">
                    <Table>
                        <TableBody>
                            {allDaysInMonth.map((day) => {
                                const dStr = format(day, 'yyyy-MM-dd');
                                const isChecked = holidays.some(d => format(d, 'yyyy-MM-dd') === dStr);
                                const isRecurringOff = (schoolConfig?.offDays ?? []).includes(day.getDay());
                                return (
                                    <TableRow key={dStr} className={cn("border-muted-foreground/5", (isChecked || isRecurringOff) && "bg-primary/5")}>
                                        <TableCell className="w-12"><Checkbox checked={isChecked || isRecurringOff} disabled={isRecurringOff} onCheckedChange={(c) => setHolidays(prev => c ? [...prev, day] : prev.filter(d => format(d, 'yyyy-MM-dd') !== dStr))} /></TableCell>
                                        <TableCell><Label className={cn("font-bold text-sm", isRecurringOff && "opacity-40 italic")}>{format(day, 'eeee, d MMMM yyyy', { locale: id })} {isRecurringOff && '(Rutin)'}</Label></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <div className="space-y-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tahun Ajaran</Label><Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="h-12 rounded-xl bg-muted/40 font-bold" /></div>
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hari Kerja Efektif</Label><p className="text-3xl font-black text-primary mt-1">{calculatedWorkDays} HARI</p></div>
                <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase tracking-widest">Catatan Libur (PDF)</Label><Switch checked={isHolidayNotesActive} onCheckedChange={setIsHolidayNotesActive} /></div>
                    {isHolidayNotesActive && (
                        <div className="space-y-3">
                            {holidayNotes.map(n => (
                                <div key={n.id} className="p-3 bg-muted/20 rounded-xl border space-y-2 relative">
                                    <Input placeholder="Tgl (misal: 15-17)" value={n.date} onChange={e => updateNote(n.id, 'date', e.target.value)} className="h-8 text-[10px] font-bold" />
                                    <Input placeholder="Keterangan" value={n.content} onChange={e => updateNote(n.id, 'content', e.target.value)} className="h-8 text-[10px] font-bold" />
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2"><Checkbox checked={n.isRed} onCheckedChange={c => updateNote(n.id, 'isRed', !!c)} /><Label className="text-[9px] font-bold text-destructive">Merah</Label></div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setHolidayNotes(prev => prev.filter(x => x.id !== n.id))}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                </div>
                            ))}
                            <Button variant="outline" className="w-full h-10 border-dashed rounded-xl text-[10px] font-bold" onClick={() => setHolidayNotes(p => [...p, { id: Math.random().toString(), date: '', content: '', isRed: false }])}>TAMBAH CATATAN</Button>
                        </div>
                    )}
                </div>
            </div>
        </CardContent>
        <CardFooter className="p-6 border-t bg-muted/5"><Button onClick={handleSave} className="w-full h-12 rounded-xl font-black tracking-widest uppercase text-xs" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" /> : 'Simpan Kalender Bulanan'}</Button></CardFooter>
    </Card>
  );
}

export default function KonfigurasiAbsenPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  
  const [holidayMode, setHolidayMode] = useState(false);
  const [offDays, setOffDays] = useState<number[]>([0, 6]);
  const [useLocationValidation, setUseLocationValidation] = useState(true);
  const [lat, setLat] = useState('-8.58333');
  const [lon, setLon] = useState('120.46667');
  const [radius, setRadius] = useState(100);
  
  // Sesi 1
  const [s1InStart, setS1InStart] = useState('06:00');
  const [s1InEnd, setS1InEnd] = useState('07:30');
  const [s1OutStart, setS1OutStart] = useState('12:00');
  const [s1OutEnd, setS1OutEnd] = useState('13:30');
  
  // Sesi 2
  const [s2InStart, setS2InStart] = useState('13:00');
  const [s2InEnd, setS2InEnd] = useState('14:30');
  const [s2OutStart, setS2OutStart] = useState('15:30');
  const [s2OutEnd, setS2OutEnd] = useState('17:00');

  const schoolConfigRef = useMemoFirebase(() => user ? doc(firestore, 'schoolConfig', 'default') : null, [user?.uid, firestore]);
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user?.uid, firestore]);

  const { data: config, isLoading } = useDoc(user, schoolConfigRef);
  const { data: userData } = useDoc(user, userDocRef);

  useEffect(() => {
    if (config) {
      setHolidayMode(config.isAttendanceActive === false); setOffDays(config.offDays ?? [0, 6]);
      setUseLocationValidation(config.useLocationValidation ?? true);
      setLat(config.latitude?.toString() ?? '-8.58333'); setLon(config.longitude?.toString() ?? '120.46667');
      setRadius(config.radius ?? 100);
      setS1InStart(config.checkInStartTime ?? '06:00'); setS1InEnd(config.checkInEndTime ?? '07:30');
      setS1OutStart(config.checkOutStartTime ?? '12:00'); setS1OutEnd(config.checkOutEndTime ?? '13:30');
      setS2InStart(config.s2CheckInStartTime ?? '13:00'); setS2InEnd(config.s2CheckInEndTime ?? '14:30');
      setS2OutStart(config.s2CheckOutStartTime ?? '15:30'); setS2OutEnd(config.s2CheckOutEndTime ?? '17:00');
      if (config.qrCodeValue) QRCode.toDataURL(config.qrCodeValue, { width: 300 }).then(setQrCodeDataUrl);
    }
  }, [config]);

  const handleSaveCommon = async () => {
    if (!schoolConfigRef) return;
    setIsSaving(true);
    try {
      await setDoc(schoolConfigRef, {
        isAttendanceActive: !holidayMode, offDays, useLocationValidation,
        latitude: parseFloat(lat), longitude: parseFloat(lon), radius: Number(radius),
        checkInStartTime: s1InStart, checkInEndTime: s1InEnd, checkOutStartTime: s1OutStart, checkOutEndTime: s1OutEnd,
        s2CheckInStartTime: s2InStart, s2CheckInEndTime: s2InEnd, s2CheckOutStartTime: s2OutStart, s2CheckOutEndTime: s2OutEnd,
      }, { merge: true });
      toast({ title: 'Berhasil', description: 'Konfigurasi umum disimpan.' });
    } catch (e) { toast({ variant: 'destructive', title: 'Gagal' }); }
    finally { setIsSaving(false); }
  };

  if (isLoading || userData?.role !== 'admin') return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-2xl border-none bg-card shadow-none overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-muted-foreground/10 text-primary">
            <CardTitle className="font-bold text-sm uppercase tracking-widest">QR Code Absensi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center p-8 gap-6">
            <div className="p-4 bg-white rounded-2xl shadow-inner border w-full max-w-[240px] aspect-square flex items-center justify-center">
              {qrCodeDataUrl ? <Image src={qrCodeDataUrl} alt="QR" width={200} height={200} /> : <Skeleton className="w-full h-full" />}
            </div>
            <Button variant="outline" className="w-full h-11 rounded-xl font-bold border-primary/20 text-primary uppercase text-[10px] tracking-widest">Ubah QR Code</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-none bg-card shadow-none overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-muted-foreground/10 text-primary"><CardTitle className="font-bold text-sm uppercase tracking-widest">Pengaturan Jam Kerja & Lokasi</CardTitle></CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label className="text-primary font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Sesi 1 (Pagi)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai Masuk</Label><Input type="time" value={s1InStart} onChange={e => setS1InStart(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas Masuk</Label><Input type="time" value={s1InEnd} onChange={e => setS1InEnd(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai Pulang</Label><Input type="time" value={s1OutStart} onChange={e => setS1OutStart(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas Pulang</Label><Input type="time" value={s1OutEnd} onChange={e => setS1OutEnd(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-primary font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Sesi 2 (Siang/Sore)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai Masuk</Label><Input type="time" value={s2InStart} onChange={e => setS2InStart(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas Masuk</Label><Input type="time" value={s2InEnd} onChange={e => setS2InEnd(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai Pulang</Label><Input type="time" value={s2OutStart} onChange={e => setS2OutStart(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas Pulang</Label><Input type="time" value={s2OutEnd} onChange={e => setS2OutEnd(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between"><Label className="font-bold text-xs uppercase">Validasi Lokasi (GPS)</Label><Switch checked={useLocationValidation} onCheckedChange={setUseLocationValidation} /></div>
                    <div className="grid grid-cols-2 gap-3 opacity-80">
                        <div className="space-y-1.5"><Label className="text-[9px] font-bold">Latitude</Label><Input value={lat} onChange={e => setLat(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                        <div className="space-y-1.5"><Label className="text-[9px] font-bold">Longitude</Label><Input value={lon} onChange={e => setLon(e.target.value)} className="h-10 rounded-lg bg-muted/40" /></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Label className="font-bold text-xs uppercase">Radius & Libur Rutin</Label>
                    <Input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} className="h-10 rounded-lg bg-muted/40" placeholder="Radius (meter)" />
                    <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(d => (
                            <div key={d.value} className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded-lg border">
                                <Checkbox checked={offDays.includes(d.value)} onCheckedChange={c => setOffDays(p => c ? [...p, d.value] : p.filter(x => x !== d.value))} />
                                <span className="text-[10px] font-bold">{d.label.substring(0,3)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </CardContent>
          <CardFooter className="p-6 border-t bg-muted/5"><Button onClick={handleSaveCommon} className="w-full h-12 rounded-xl font-black tracking-widest uppercase text-xs" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" /> : 'Simpan Konfigurasi Umum'}</Button></CardFooter>
        </Card>
      </div>
      <MonthlyConfigCalendar user={user} schoolConfig={config} />
    </div>
  );
}
