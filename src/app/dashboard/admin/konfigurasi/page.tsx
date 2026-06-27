'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
import { Download, Loader2, RefreshCw, LocateFixed, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { format, getDaysInMonth, startOfMonth, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

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
  const [manualWorkDays, setManualWorkDays] = useState<string>('');
  const [calculatedWorkDays, setCalculatedWorkDays] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const monthlyConfigId = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
  const monthlyConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'monthlyConfigs', monthlyConfigId);
  }, [firestore, monthlyConfigId]);
  
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
      setManualWorkDays(monthlyConfigData.manualWorkDays?.toString() ?? '');
    } else {
      setHolidays([]);
      setManualWorkDays('');
    }
  }, [monthlyConfigData]);

  useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const recurringOffDays: number[] = schoolConfig?.offDays ?? [0];
    const specificHolidays = new Set(holidays.map(d => format(d, 'yyyy-MM-dd')));

    const workDays = allDays.filter(day => {
      const isRecurringOff = recurringOffDays.includes(day.getDay());
      const isSpecificHoliday = specificHolidays.has(format(day, 'yyyy-MM-dd'));
      return !isRecurringOff && !isSpecificHoliday;
    });

    setCalculatedWorkDays(workDays.length);
  }, [currentMonth, holidays, schoolConfig?.offDays]);


  const handleSave = async () => {
    if (!monthlyConfigRef) return;
    setIsSaving(true);
    
    const totalDaysInMonth = getDaysInMonth(currentMonth);
    const manualWorkDaysValue = manualWorkDays === '' ? null : parseInt(manualWorkDays, 10);

    if (manualWorkDaysValue !== null && (isNaN(manualWorkDaysValue) || manualWorkDaysValue < 0 || manualWorkDaysValue > totalDaysInMonth)) {
        toast({
            variant: 'destructive',
            title: 'Input tidak valid',
            description: `Jumlah hari kerja harus berupa angka antara 0 dan ${totalDaysInMonth}.`
        });
        setIsSaving(false);
        return;
    }

    try {
      const dataToSave = {
        id: monthlyConfigId,
        holidays: holidays.map(d => format(d, 'yyyy-MM-dd')),
        manualWorkDays: manualWorkDaysValue,
      };
      await setDoc(monthlyConfigRef, dataToSave, { merge: true });
      toast({ title: 'Berhasil', description: 'Pengaturan hari kerja dan libur telah disimpan.' });
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
    setManualWorkDays(''); 
  };
  
  return (
    <Card className="lg:col-span-3 overflow-hidden shadow-sm">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
            <CardTitle className="font-bold text-sm tracking-tight">Hari Kerja & Libur Bulanan</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
                Tandai hari libur spesifik atau tentukan jumlah hari kerja efektif.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 sm:p-6">
            <div className="md:col-span-2 space-y-4">
                {isMonthlyConfigLoading ? (
                    <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-2xl p-10">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-center gap-4">
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="rounded-full"
                                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="font-bold text-center w-32">{format(currentMonth, 'MMMM yyyy', { locale: id })}</span>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="rounded-full"
                                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <ScrollArea className="h-96 rounded-2xl border bg-muted/10">
                            <Table>
                                <TableBody>
                                    {allDaysInMonth.map((day) => {
                                        const dayString = format(day, 'yyyy-MM-dd');
                                        const isChecked = holidays.some(d => format(d, 'yyyy-MM-dd') === dayString);

                                        return (
                                            <TableRow key={dayString} className="has-[:checked]:bg-primary/5 border-muted-foreground/5">
                                                <TableCell className="w-12 text-center py-2">
                                                    <Checkbox
                                                        id={dayString}
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => handleDayToggle(day, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Label htmlFor={dayString} className="font-medium text-sm cursor-pointer w-full block">
                                                        {format(day, 'eeee, d MMMM yyyy', { locale: id })}
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
            <div className="md:col-span-1 space-y-4 border-l-0 md:border-l md:pl-6 border-muted-foreground/10">
                <h3 className="font-bold text-sm tracking-tight text-primary">Status Bulan Ini</h3>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                    Jumlah hari kerja efektif di bulan <span className="font-bold">{format(currentMonth, 'MMMM', { locale: id })}</span> digunakan untuk hitung persentase kehadiran.
                </p>
                <div className="space-y-2">
                    <Label htmlFor="manualWorkDays" className="text-xs font-bold">Jumlah Hari Kerja (Manual)</Label>
                    <Input
                        id="manualWorkDays"
                        type="number"
                        className="rounded-xl h-11 bg-muted/30"
                        value={manualWorkDays}
                        onChange={(e) => setManualWorkDays(e.target.value)}
                        placeholder={calculatedWorkDays.toString()}
                    />
                     <p className="text-[10px] font-bold text-muted-foreground">
                        Dihitung otomatis: <span className="text-primary">{calculatedWorkDays} hari</span>.
                    </p>
                </div>
            </div>
        </CardContent>
         <CardFooter className="border-t p-4 sm:p-6 bg-muted/5">
            <Button onClick={handleSave} className="w-full sm:w-auto font-bold rounded-xl h-11 shadow-sm" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Pengaturan Bulan Ini
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
  const [offDays, setOffDays] = useState<number[]>([]);

  const [useLocationValidation, setUseLocationValidation] = useState(true);
  const [useTimeValidation, setUseTimeValidation] = useState(true);
  const [latitude, setLatitude] = useState('-8.58333');
  const [longitude, setLongitude] = useState('120.46667');
  const [radius, setRadius] = useState(100);
  const [checkInStart, setCheckInStart] = useState('06:00');
  const [checkInEnd, setCheckInEnd] = useState('08:00');
  const [lateTolerance, setLateTolerance] = useState(15);
  const [checkOutStart, setCheckOutStart] = useState('14:00');
  const [checkOutEnd, setCheckOutEnd] = useState('16:00');
  const [qrCodeValue, setQrCodeValue] = useState('');
  
  const schoolConfigRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'schoolConfig', 'default');
  }, [firestore, user]);
  const { data: schoolConfigData, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);

  const isLoading = isAuthLoading || isConfigLoading || isUserDataLoading;
  const isAdmin = !isLoading && userData?.role === 'admin';
  

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAdmin, router]);

  useEffect(() => {
    if (schoolConfigData) {
      setHolidayMode(schoolConfigData.isAttendanceActive === false);
      setOffDays(schoolConfigData.offDays ?? [0, 6]);

      setUseLocationValidation(schoolConfigData.useLocationValidation ?? true);
      setUseTimeValidation(schoolConfigData.useTimeValidation ?? true);
      setLatitude(schoolConfigData.latitude?.toString() ?? '-8.58333');
      setLongitude(schoolConfigData.longitude?.toString() ?? '120.46667');
      setRadius(schoolConfigData.radius ?? 100);
      setCheckInStart(schoolConfigData.checkInStartTime ?? '06:00');
      setCheckInEnd(schoolConfigData.checkInEndTime ?? '08:00');
      setLateTolerance(schoolConfigData.lateTolerance ?? 15);
      setCheckOutStart(schoolConfigData.checkOutStartTime ?? '14:00');
      setCheckOutEnd(schoolConfigData.checkOutEndTime ?? '16:00');

      if (schoolConfigData.qrCodeValue) {
        setQrCodeValue(schoolConfigData.qrCodeValue);
      } else if (user && schoolConfigRef && !isConfigLoading) {
        const newQrValue = Math.random().toString(36).substring(2, 15);
        setQrCodeValue(newQrValue);
        updateDocumentNonBlocking(schoolConfigRef, { qrCodeValue: newQrValue });
      }
    }
  }, [schoolConfigData, user, schoolConfigRef, isConfigLoading]);

  useEffect(() => {
    const generateQrCode = async () => {
      if (qrCodeValue) {
        setIsQrLoading(true);
        try {
          const url = await QRCode.toDataURL(qrCodeValue, {
            width: 300,
            margin: 2,
            errorCorrectionLevel: 'H'
          });
          setQrCodeDataUrl(url);
        } catch (err) {
          console.error('QR Code generation failed:', err);
          toast({
            variant: 'destructive',
            title: 'Gagal membuat kode QR',
            description: 'Terjadi kesalahan saat menyiapkan kode QR.',
          });
        } finally {
          setIsQrLoading(false);
        }
      } else {
        setIsQrLoading(!isConfigLoading);
      }
    };

    generateQrCode();
  }, [qrCodeValue, toast, isConfigLoading]);


  const downloadQRCode = async () => {
    if (!qrCodeDataUrl) {
      toast({
        variant: 'destructive',
        title: 'Gagal mengunduh',
        description: 'Kode QR belum siap. Mohon tunggu sejenak.',
      });
      return;
    }
    const downloadLink = document.createElement('a');
    downloadLink.href = qrCodeDataUrl;
    downloadLink.download = 'absensi-qrcode.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    toast({
      title: 'Berhasil',
      description: `Kode QR berhasil diunduh sebagai PNG.`,
    });
  };
  
  const handleGenerateNewQr = () => {
    if (!user || !schoolConfigRef) return;
    setIsQrLoading(true);
    const newQrValue = Math.random().toString(36).substring(2, 15);
    updateDocumentNonBlocking(schoolConfigRef, { qrCodeValue: newQrValue });
    setQrCodeValue(newQrValue);
    toast({
      title: 'Kode QR diperbarui',
      description: 'Kode QR absensi baru telah berhasil dibuat.',
    });
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'Layanan tidak didukung',
        description: 'Browser Anda tidak mendukung pengambilan lokasi.',
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
        toast({
          title: 'Lokasi ditemukan',
          description: 'Koordinat latitude dan longitude telah diperbarui.',
        });
      },
      (error) => {
        setIsLocating(false);
        let description = 'Terjadi kesalahan saat mengambil lokasi.';
        if (error.code === 1) {
          description = 'Akses lokasi ditolak. Aktifkan izin lokasi di browser.';
        }
        toast({
          variant: 'destructive',
          title: 'Gagal mendapatkan lokasi',
          description,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };


  const handleSave = () => {
    if (!user || !schoolConfigRef) return;
    setIsSaving(true);
    setDocumentNonBlocking(schoolConfigRef, {
      isAttendanceActive: !holidayMode,
      offDays: offDays,
      useLocationValidation,
      useTimeValidation,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: Number(radius),
      checkInStartTime: checkInStart,
      checkInEndTime: checkInEnd,
      lateTolerance: Number(lateTolerance),
      checkOutStartTime: checkOutStart,
      checkOutEndTime: checkOutEnd,
    }, { merge: true });
    toast({
      title: 'Pengaturan disimpan',
      description: 'Konfigurasi absensi telah berhasil diperbarui.',
    });
    setIsSaving(false);
  };

  const handleDayToggle = (dayValue: number, checked: boolean | 'indeterminate') => {
    if (checked) {
        setOffDays(prev => [...prev, dayValue].sort());
    } else {
        setOffDays(prev => prev.filter(d => d !== dayValue));
    }
  };
  
  if (isLoading || !isAdmin) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 overflow-hidden shadow-sm">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-bold text-sm tracking-tight">Kode QR Absensi</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">Gunakan Kode QR ini untuk absensi harian.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-4 sm:p-6">
          <div className="p-4 border rounded-2xl bg-white aspect-square w-full max-w-[256px] relative shadow-inner">
            {isQrLoading || !qrCodeDataUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Image src={qrCodeDataUrl} alt="Kode QR Absensi" width={224} height={224} className="w-full h-full" />
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full max-w-[256px] rounded-xl font-bold" disabled={isQrLoading}>
                    {isQrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Buat QR Baru
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl border-none">
                <AlertDialogHeader>
                    <AlertDialogTitle className="font-bold text-xl">Perbarui Kode QR?</AlertDialogTitle>
                    <AlertDialogDescription className="font-medium text-sm">
                        Kode QR lama tidak akan bisa digunakan lagi setelah Anda membuat yang baru. Apakah Anda yakin ingin membuat kode QR baru?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold">Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGenerateNewQr} className="rounded-xl font-bold bg-primary hover:bg-primary/90">Ya, Buat Baru</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t p-4 sm:p-6 bg-muted/5">
          <Button variant="outline" className="w-full rounded-xl font-bold h-11" onClick={downloadQRCode} disabled={isQrLoading}><Download className="mr-2 h-4 w-4" />Unduh PNG</Button>
        </CardFooter>
      </Card>

      <Card className="lg:col-span-2 overflow-hidden shadow-sm">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-bold text-sm tracking-tight">Pengaturan Umum</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">Atur parameter sistem absensi sekolah.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="rounded-2xl border p-4 space-y-4 bg-muted/5">
              <div className="flex items-center justify-between">
                  <div>
                      <Label htmlFor="holiday-mode" className="font-bold text-sm">Nonaktifkan Absensi</Label>
                      <p className="text-xs text-muted-foreground">Sistem absensi akan dinonaktifkan sementara untuk semua.</p>
                  </div>
                  <Switch
                      id="holiday-mode"
                      checked={holidayMode}
                      onCheckedChange={setHolidayMode}
                  />
              </div>
              <div className="space-y-4 pt-4 border-t border-muted-foreground/10">
                  <Label className='text-xs font-bold opacity-70'>Hari Libur Rutin</Label>
                  <p className="text-xs text-muted-foreground">
                    Pilih hari libur mingguan tetap.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {daysOfWeek.map(day => (
                        <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                            id={`day-${day.value}`}
                            checked={offDays.includes(day.value)}
                            onCheckedChange={(checked) => handleDayToggle(day.value, checked)}
                            disabled={holidayMode}
                        />
                        <Label htmlFor={`day-${day.value}`} className="font-bold text-xs">{day.label}</Label>
                        </div>
                    ))}
                  </div>
              </div>
          </div>

          <div className="rounded-2xl border p-4 space-y-4 bg-muted/5">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-location" className="font-bold text-sm">Validasi Lokasi (GPS)</Label>
                <p className="text-xs text-muted-foreground">Wajibkan pengguna berada di area sekolah.</p>
              </div>
              <Switch id="use-location" checked={useLocationValidation} onCheckedChange={setUseLocationValidation} disabled={holidayMode} />
            </div>
            {useLocationValidation && (
              <div className="space-y-4 pt-4 border-t border-muted-foreground/10">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-xs font-bold">Koordinat Sekolah</Label>
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold" onClick={handleGetCurrentLocation} disabled={isLocating || holidayMode}>
                      {isLocating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <LocateFixed className="mr-2 h-3 w-3" />}
                      Dapatkan Lokasi
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="latitude" className="text-[10px] font-bold text-muted-foreground">Latitude</Label>
                        <Input id="latitude" type="text" className="h-10 rounded-xl bg-muted/30" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-8.58333" disabled={holidayMode || isLocating} />
                    </div>
                    <div>
                        <Label htmlFor="longitude" className="text-[10px] font-bold text-muted-foreground">Longitude</Label>
                        <Input id="longitude" type="text" className="h-10 rounded-xl bg-muted/30" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="120.46667" disabled={holidayMode || isLocating} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius" className="text-xs font-bold">Radius Sekolah (Meter)</Label>
                  <Input id="radius" type="number" className="h-10 rounded-xl bg-muted/30" value={radius} onChange={(e) => setRadius(Number(e.target.value))} placeholder="100" disabled={holidayMode} />
                </div>
                <div className="aspect-video w-full overflow-hidden rounded-2xl border shadow-inner">
                    <iframe
                      key={`${latitude}-${longitude}`}
                      width="100%"
                      height="100%"
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${latitude},${longitude}&hl=id&z=15&output=embed`}
                      title="Pratinjau Lokasi"
                    ></iframe>
                </div>
              </div>
            )}
          </div>
          
          <div className="rounded-2xl border p-4 space-y-4 bg-muted/5">
              <div className="flex items-center justify-between">
                  <div>
                      <Label htmlFor="use-time" className="font-bold text-sm">Validasi Jam Kerja</Label>
                      <p className="text-xs text-muted-foreground">Wajibkan pengguna absen sesuai jadwal.</p>
                  </div>
                  <Switch id="use-time" checked={useTimeValidation} onCheckedChange={setUseTimeValidation} disabled={holidayMode} />
              </div>
              {useTimeValidation && (
                  <div className="space-y-4 pt-4 border-t border-muted-foreground/10">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                              <Label htmlFor="checkin-start" className="text-[10px] font-bold">Mulai Masuk</Label>
                              <Input id="checkin-start" type="time" className="rounded-xl h-10 bg-muted/30" value={checkInStart} onChange={e => setCheckInStart(e.target.value)} disabled={holidayMode} />
                          </div>
                          <div className="space-y-1.5">
                              <Label htmlFor="checkin-end" className="text-[10px] font-bold">Selesai Masuk</Label>
                              <Input id="checkin-end" type="time" className="rounded-xl h-10 bg-muted/30" value={checkInEnd} onChange={e => setCheckInEnd(e.target.value)} disabled={holidayMode} />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="late-tolerance" className="text-xs font-bold">Toleransi Terlambat (Menit)</Label>
                          <Input id="late-tolerance" type="number" className="rounded-xl h-10 bg-muted/30" value={lateTolerance} onChange={e => setLateTolerance(Number(e.target.value))} placeholder="15" disabled={holidayMode} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-muted-foreground/10">
                          <div className="space-y-1.5">
                              <Label htmlFor="checkout-start" className="text-[10px] font-bold">Mulai Pulang</Label>
                              <Input id="checkout-start" type="time" className="rounded-xl h-10 bg-muted/30" value={checkOutStart} onChange={e => setCheckOutStart(e.target.value)} disabled={holidayMode} />
                          </div>
                          <div className="space-y-1.5">
                              <Label htmlFor="checkout-end" className="text-[10px] font-bold">Selesai Pulang</Label>
                              <Input id="checkout-end" type="time" className="rounded-xl h-10 bg-muted/30" value={checkOutEnd} onChange={e => setCheckOutEnd(e.target.value)} disabled={holidayMode} />
                          </div>
                      </div>
                  </div>
              )}
          </div>
        </CardContent>
         <CardFooter className="border-t p-4 sm:p-6 bg-muted/5">
           <Button onClick={handleSave} className="w-full sm:w-auto font-bold rounded-xl h-11 shadow-sm" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Pengaturan Umum
          </Button>
        </CardFooter>
      </Card>

      {schoolConfigData && <MonthlyConfigCalendar user={user} schoolConfig={schoolConfigData} />}
    </div>
  );
}
