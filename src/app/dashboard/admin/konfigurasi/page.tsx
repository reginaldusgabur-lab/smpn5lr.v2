
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
import { Loader2, ChevronLeft, ChevronRight, Plus, Trash2, Clock, MapPin, QrCode as QrIcon } from 'lucide-react';
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
    { value: 0, label: 'Minggu' },
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
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
    if (!firestore || !user) return null;
    return doc(firestore, 'monthlyConfigs', monthlyConfigId);
  }, [firestore, user?.uid, monthlyConfigId]);
  
  const { data: monthlyConfigData, isLoading: isMonthlyConfigLoading } = useDoc(user, monthlyConfigRef);
  
  const allDaysInMonth = useMemo(() => {
    return eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    });
  }, [currentMonth]);

  useEffect(() => {
    if (monthlyConfigData) {
      setHolidays((monthlyConfigData.holidays ?? []).map((d: string) => new Date(`${d}T00:00:00`)));
      setAcademicYear(monthlyConfigData.academicYear || schoolConfig?.academicYear || '');
      setIsHolidayNotesActive(monthlyConfigData.isHolidayNotesActive ?? false);
      setHolidayNotes(monthlyConfigData.holidayNotes || []);
    } else {
      setHolidays([]);
      setAcademicYear(schoolConfig?.academicYear || '');
      setIsHolidayNotesActive(false);
      setHolidayNotes([]);
    }
  }, [monthlyConfigData, schoolConfig?.academicYear]);

  const calculatedWorkDays = useMemo(() => {
    if (!schoolConfig) return 0;
    const recurringOffDays: number[] = schoolConfig.offDays ?? [0, 6];
    const specificHolidays = new Set(holidays.map(d => format(d, 'yyyy-MM-dd')));

    return allDaysInMonth.filter(day => {
      const isRecurringOff = recurringOffDays.includes(day.getDay());
      const isSpecificHoliday = specificHolidays.has(format(day, 'yyyy-MM-dd'));
      return !isRecurringOff && !isSpecificHoliday;
    }).length;
  }, [allDaysInMonth, holidays, schoolConfig?.offDays]);


  const handleSave = async () => {
    if (!monthlyConfigRef) return;
    setIsSaving(true);
    
    try {
      const dataToSave = {
        id: monthlyConfigId,
        holidays: holidays.map(d => format(d, 'yyyy-MM-dd')),
        manualWorkDays: calculatedWorkDays, 
        academicYear: academicYear,
        isHolidayNotesActive,
        holidayNotes: holidayNotes.filter(n => n.date.trim() !== '' || n.content.trim() !== '')
      };
      await setDoc(monthlyConfigRef, dataToSave, { merge: true });
      toast({ title: 'Berhasil', description: 'Pengaturan bulanan telah disimpan.' });
    } catch (error) {
      console.error('Error saving monthly config:', error);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan pengaturan.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDayToggle = (day: Date, checked: boolean) => {
    setHolidays(prev => 
        checked 
        ? [...prev, day]
        : prev.filter(d => format(d, 'yyyy-MM-dd') !== format(day, 'yyyy-MM-dd'))
    );
  };

  const addNote = () => {
    setHolidayNotes(prev => [...prev, { id: Math.random().toString(36).substring(7), date: '', content: '', isRed: false }]);
  };

  const removeNote = (id: string) => {
    setHolidayNotes(prev => prev.filter(n => n.id !== id));
  };

  const updateNote = (id: string, field: 'date' | 'content' | 'isRed', value: any) => {
    setHolidayNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
  };
  
  return (
    <Card className="lg:col-span-3 overflow-hidden border shadow-none rounded-xl">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
            <CardTitle className="font-bold text-sm tracking-tight uppercase">Kalender Kerja & Hari Libur</CardTitle>
            <CardDescription className="text-muted-foreground font-bold">
                Tentukan hari libur spesifik untuk bulan ini.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 sm:p-6">
            <div className="md:col-span-2 space-y-4">
                {isMonthlyConfigLoading ? (
                    <div className="w-full h-full flex flex-col gap-2 bg-muted/30 rounded-xl p-10">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-center gap-4">
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="rounded-full shadow-none"
                                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="font-bold text-center w-32">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="rounded-full shadow-none"
                                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <ScrollArea className="h-96 rounded-xl border bg-muted/10">
                            <Table>
                                <TableBody>
                                    {allDaysInMonth.map((day) => {
                                        const dayString = format(day, 'yyyy-MM-dd');
                                        const isChecked = holidays.some(d => format(d, 'yyyy-MM-dd') === dayString);
                                        const isRecurringOff = (schoolConfig?.offDays ?? []).includes(day.getDay());

                                        return (
                                            <TableRow key={dayString} className={cn(
                                                "border-muted-foreground/5 transition-colors",
                                                (isChecked || isRecurringOff) ? "bg-primary/5" : "",
                                                isRecurringOff && "bg-muted/30"
                                            )}>
                                                <TableCell className="w-12 text-center py-2">
                                                    <Checkbox
                                                        id={dayString}
                                                        checked={isChecked || isRecurringOff}
                                                        disabled={isRecurringOff}
                                                        onCheckedChange={(checked) => handleDayToggle(day, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Label htmlFor={dayString} className={cn(
                                                        "font-bold text-sm block w-full",
                                                        isRecurringOff ? "cursor-not-allowed opacity-60 italic" : "cursor-pointer"
                                                    )}>
                                                        {format(day, 'eeee, d MMMM yyyy', { locale: id })}
                                                        {isRecurringOff && <span className="ml-2 text-[10px] font-medium opacity-70">(Libur rutin)</span>}
                                                    </Label>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </>
                )}
            </div>
            <div className="md:col-span-1 space-y-6 border-l-0 md:border-l md:pl-6 border-muted-foreground/10">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                         Tahun Ajaran
                    </Label>
                    <Input 
                        placeholder="Contoh: 2026/2027" 
                        value={academicYear} 
                        onChange={e => setAcademicYear(e.target.value)}
                        className="h-11 rounded-xl bg-muted/40 font-bold shadow-none"
                    />
                </div>

                <div className="pt-4 border-t border-muted-foreground/10 space-y-4">
                    <h3 className="font-bold text-[10px] uppercase tracking-widest text-primary">Status bulan ini</h3>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold ml-1 text-primary">Hari kerja efektif</Label>
                        <div className="h-11 w-full rounded-xl bg-muted/40 border border-muted-foreground/10 flex items-center px-4 font-black text-primary shadow-inner">
                            {isMonthlyConfigLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${calculatedWorkDays} hari`}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-muted-foreground/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Keterangan Libur (PDF)</Label>
                        <Switch checked={isHolidayNotesActive} onCheckedChange={setIsHolidayNotesActive} />
                    </div>
                    {isHolidayNotesActive && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                {holidayNotes.map((note) => (
                                    <div key={note.id} className="p-3 rounded-xl bg-muted/30 border border-muted-foreground/10 space-y-3 relative group">
                                        <div className="grid grid-cols-1 gap-2">
                                            <div>
                                                <Label className="text-[8px] font-bold uppercase text-muted-foreground ml-1">Tgl/Rentang</Label>
                                                <Input 
                                                    placeholder="Contoh: 15-20" 
                                                    value={note.date}
                                                    onChange={e => updateNote(note.id, 'date', e.target.value)}
                                                    className="h-8 rounded-lg bg-background font-bold text-[10px] shadow-none"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[8px] font-bold uppercase text-muted-foreground ml-1">Keterangan</Label>
                                                <Input 
                                                    placeholder="Nama hari libur" 
                                                    value={note.content}
                                                    onChange={e => updateNote(note.id, 'content', e.target.value)}
                                                    className="h-8 rounded-lg bg-background font-bold text-[10px] shadow-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-2">
                                                <Checkbox 
                                                    id={`red-${note.id}`} 
                                                    checked={note.isRed} 
                                                    onCheckedChange={(checked) => updateNote(note.id, 'isRed', !!checked)} 
                                                />
                                                <Label htmlFor={`red-${note.id}`} className="text-[9px] font-bold text-destructive flex items-center gap-1">
                                                    Tandai Merah
                                                </Label>
                                            </div>
                                            <button className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full flex items-center justify-center transition-colors" onClick={() => removeNote(note.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" className="w-full h-9 rounded-lg border-dashed font-bold text-[10px] uppercase tracking-wider" onClick={addNote}>
                                    Tambah Baris Catatan
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </CardContent>
         <CardFooter className="border-t p-4 sm:p-6 bg-muted/5">
            <Button onClick={handleSave} className="w-full sm:w-auto font-bold rounded-xl h-11 px-8 shadow-none" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                SIMPAN PENGATURAN BULANAN
            </Button>
        </CardFooter>
    </Card>
  );
}


export default function KonfigurasiAbsenPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isQrLoading, setIsQrLoading] = useState(true);

  // Form State
  const [holidayMode, setHolidayMode] = useState(false);
  const [isSesi2Active, setIsSesi2Active] = useState(false);
  const [offDays, setOffDays] = useState<number[]>([]);

  const [useLocationValidation, setUseLocationValidation] = useState(true);
  const [useTimeValidation, setUseTimeValidation] = useState(true);
  const [latitude, setLatitude] = useState('-8.58333');
  const [longitude, setLongitude] = useState('120.46667');
  const [radius, setRadius] = useState(100);
  
  const [checkInStart, setCheckInStart] = useState('06:00');
  const [checkInEnd, setCheckInEnd] = useState('08:00');
  const [checkOutStart, setCheckOutStart] = useState('14:00');
  const [checkOutEnd, setCheckOutEnd] = useState('16:00');
  
  const [s2CheckInStart, setS2CheckInStart] = useState('13:00');
  const [s2CheckInEnd, setS2CheckInEnd] = useState('14:30');
  const [s2CheckOutStart, setS2CheckOutStart] = useState('15:30');
  const [s2CheckOutEnd, setS2CheckOutEnd] = useState('17:00');

  const [qrCodeValue, setQrCodeValue] = useState('');
  
  const schoolConfigRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'schoolConfig', 'default');
  }, [firestore, user?.uid]);
  const { data: config, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);

  const isLoading = isAuthLoading || isConfigLoading || isUserDataLoading;
  const isAdmin = !isLoading && userData?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAdmin, router]);

  useEffect(() => {
    if (config) {
      setHolidayMode(config.isAttendanceActive === false);
      setIsSesi2Active(config.isSesi2Active ?? false);
      setOffDays(config.offDays ?? [0, 6]);

      setUseLocationValidation(config.useLocationValidation ?? true);
      setUseTimeValidation(config.useTimeValidation ?? true);
      setLatitude(config.latitude?.toString() ?? '-8.58333');
      setLongitude(config.longitude?.toString() ?? '120.46667');
      setRadius(config.radius ?? 100);
      
      setCheckInStart(config.checkInStartTime ?? '06:00');
      setCheckInEnd(config.checkInEndTime ?? '08:00');
      setCheckOutStart(config.checkOutStartTime ?? '14:00');
      setCheckOutEnd(config.checkOutEndTime ?? '16:00');

      setS2CheckInStart(config.s2CheckInStartTime ?? '13:00');
      setS2CheckInEnd(config.s2CheckInEndTime ?? '14:30');
      setS2CheckOutStart(config.s2CheckOutStartTime ?? '15:30');
      setS2CheckOutEnd(config.s2CheckOutEndTime ?? '17:00');

      if (config.qrCodeValue) {
        setQrCodeValue(config.qrCodeValue);
      }
    }
  }, [config]);

  useEffect(() => {
    if (qrCodeValue) {
      setIsQrLoading(true);
      QRCode.toDataURL(qrCodeValue, { width: 300, margin: 2, errorCorrectionLevel: 'H' })
        .then(url => { setQrCodeDataUrl(url); setIsQrLoading(false); })
        .catch(() => setIsQrLoading(false));
    }
  }, [qrCodeValue]);


  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = 'absensi-qrcode.png';
    link.click();
  };
  
  const handleGenerateNewQr = async () => {
    if (!schoolConfigRef) return;
    setIsQrLoading(true);
    const newQrValue = Math.random().toString(36).substring(2, 15);
    await setDoc(schoolConfigRef, { qrCodeValue: newQrValue }, { merge: true });
    setQrCodeValue(newQrValue);
    toast({ title: 'QR Code diperbarui' });
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  };


  const handleSave = async () => {
    if (!schoolConfigRef) return;
    setIsSaving(true);
    try {
      await setDoc(schoolConfigRef, {
        isAttendanceActive: !holidayMode,
        isSesi2Active,
        offDays,
        useLocationValidation,
        useTimeValidation,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: Number(radius),
        checkInStartTime: checkInStart,
        checkInEndTime: checkInEnd,
        checkOutStartTime: checkOutStart,
        checkOutEndTime: checkOutEnd,
        s2CheckInStartTime: s2CheckInStart,
        s2CheckInEndTime: s2CheckInEnd,
        s2CheckOutStartTime: s2CheckOutStart,
        s2CheckOutEndTime: s2CheckOutEnd,
      }, { merge: true });
      invalidateCache();
      toast({ title: 'Pengaturan disimpan' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !isAdmin) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24">
      <Card className="lg:col-span-1 overflow-hidden border shadow-none rounded-xl">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-bold text-sm tracking-tight uppercase">Kode QR absensi</CardTitle>
          <CardDescription className="text-muted-foreground font-bold">Gunakan kode QR ini untuk absensi harian.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-6">
          <div className="p-4 border rounded-2xl bg-white aspect-square w-full max-w-[256px] relative shadow-sm">
            {isQrLoading || !qrCodeDataUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Image src={qrCodeDataUrl} alt="Kode QR" width={224} height={224} className="w-full h-full" />
            )}
          </div>
          <Button variant="outline" className="w-full max-w-[256px] rounded-xl font-bold h-11" onClick={handleGenerateNewQr} disabled={isQrLoading}>
            Buat QR baru
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t p-4 sm:p-6 bg-muted/5">
          <Button variant="outline" className="w-full rounded-xl font-bold h-11 shadow-none" onClick={downloadQRCode} disabled={isQrLoading}>Unduh PNG</Button>
        </CardFooter>
      </Card>

      <Card className="lg:col-span-2 overflow-hidden border shadow-none rounded-xl">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-bold text-sm tracking-tight uppercase">Pengaturan Umum</CardTitle>
          <CardDescription className="text-muted-foreground font-bold">Atur parameter sistem absensi sekolah.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="rounded-2xl border p-5 bg-muted/5 flex items-center justify-between">
              <div>
                  <Label className="font-bold text-sm">Nonaktifkan absensi</Label>
                  <p className="text-[11px] text-muted-foreground font-bold">Sistem absensi akan dinonaktifkan sementara untuk semua.</p>
              </div>
              <Switch checked={holidayMode} onCheckedChange={setHolidayMode} />
          </div>

          <div className="space-y-4 pt-4 border-t">
              <Label className='text-[10px] font-black uppercase tracking-widest text-primary opacity-70'>Hari libur rutin</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {daysOfWeek.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                        id={`day-${day.value}`}
                        checked={offDays.includes(day.value)}
                        onCheckedChange={(checked) => setOffDays(prev => !!checked ? [...prev, day.value].sort() : prev.filter(d => d !== day.value))}
                    />
                    <Label htmlFor={`day-${day.value}`} className="font-bold text-xs">{day.label}</Label>
                    </div>
                ))}
              </div>
          </div>

          <div className="rounded-2xl border p-5 space-y-4 bg-muted/5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-sm">Validasi lokasi (GPS)</Label>
                <p className="text-[11px] text-muted-foreground font-bold">Wajibkan pengguna berada di area sekolah.</p>
              </div>
              <Switch checked={useLocationValidation} onCheckedChange={setUseLocationValidation} />
            </div>
            {useLocationValidation && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between gap-4">
                    <Label className="text-xs font-bold">Koordinat sekolah</Label>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg font-bold text-[10px]" onClick={handleGetCurrentLocation} disabled={isLocating}>
                      Dapatkan lokasi
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Lat" className="h-10 rounded-xl bg-muted/30 font-bold" />
                    <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Lon" className="h-10 rounded-xl bg-muted/30 font-bold" />
                </div>
                <Input value={radius} type="number" onChange={(e) => setRadius(Number(e.target.value))} placeholder="Radius (Meter)" className="h-10 rounded-xl bg-muted/30 font-bold" />
              </div>
            )}
          </div>
          
          <div className="rounded-2xl border p-5 space-y-6 bg-muted/5">
              <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm">Validasi jam kerja</Label>
                  <Switch checked={useTimeValidation} onCheckedChange={setUseTimeValidation} />
              </div>
              
              {useTimeValidation && (
                  <div className="space-y-8 pt-4 border-t">
                      <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Jadwal Sesi 1 (Pagi)</Label>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai masuk</Label>
                                  <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={checkInStart} onChange={e => setCheckInStart(e.target.value)} />
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas masuk</Label>
                                  <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={checkInEnd} onChange={e => setCheckInEnd(e.target.value)} />
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai pulang</Label>
                                  <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={checkOutStart} onChange={e => setCheckOutStart(e.target.value)} />
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas pulang</Label>
                                  <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={checkOutEnd} onChange={e => setCheckOutEnd(e.target.value)} />
                              </div>
                          </div>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-muted-foreground/10">
                          <div className="flex items-center justify-between mb-2">
                             <div>
                                <Label className="font-bold text-sm">Aktifkan Absensi Sesi 2</Label>
                                <p className="text-[11px] text-muted-foreground font-bold">Gunakan absensi siang secara independen.</p>
                             </div>
                             <Switch checked={isSesi2Active} onCheckedChange={setIsSesi2Active} />
                          </div>
                          
                          {isSesi2Active && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Jadwal Sesi 2 (Siang)</Label>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                          <Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai masuk</Label>
                                          <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={s2CheckInStart} onChange={e => setS2CheckInStart(e.target.value)} />
                                      </div>
                                      <div className="space-y-1.5">
                                          <Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas masuk</Label>
                                          <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={s2CheckInEnd} onChange={e => setS2CheckInEnd(e.target.value)} />
                                      </div>
                                      <div className="space-y-1.5">
                                          <Label className="text-[9px] font-bold uppercase text-muted-foreground">Mulai pulang</Label>
                                          <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={s2CheckOutStart} onChange={e => setS2CheckOutStart(e.target.value)} />
                                      </div>
                                      <div className="space-y-1.5">
                                          <Label className="text-[9px] font-bold uppercase text-muted-foreground">Batas pulang</Label>
                                          <Input type="time" className="rounded-lg h-10 bg-background font-bold shadow-none" value={s2CheckOutEnd} onChange={e => setS2CheckOutEnd(e.target.value)} />
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
        </CardContent>
         <CardFooter className="border-t p-6 bg-muted/5 flex justify-end">
            <Button onClick={handleSave} className="font-bold rounded-xl h-11 px-10 shadow-none" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                SIMPAN KONFIGURASI
            </Button>
        </CardFooter>
      </Card>

      {config && <MonthlyConfigCalendar user={user} schoolConfig={config} />}
    </div>
  );
}

function invalidateCache() {
    if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach(k => {
            if (k.startsWith('espenli_cache_')) sessionStorage.removeItem(k);
        });
    }
}
