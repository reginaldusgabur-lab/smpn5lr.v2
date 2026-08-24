
'use client';

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, Camera, Eye, EyeOff, UserCircle, Settings2, BellRing, KeyRound, FileText, Check, Scissors, Volume2, Play, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updatePassword, updateProfile } from 'firebase/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { invalidateCache } from '@/lib/cache';
import Cropper, { Area, Point } from 'react-easy-crop';
import { cn } from '@/lib/utils';

/**
 * Helper to process image cropping and compression on a canvas.
 */
const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => { image.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    const targetSize = 800;
    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetSize,
        targetSize
    );

    return canvas.toDataURL('image/jpeg', 0.8);
};

export default function PengaturanPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [nisn, setNisn] = useState('');
  const [position, setPosition] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCroppingModalOpen, setIsCroppingModalOpen] = useState(false);

  const [isReportSaving, setIsReportSaving] = useState(false);
  const [governmentAgency, setGovernmentAgency] = useState('');
  const [educationAgency, setEducationAgency] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [headmasterName, setHeadmasterName] = useState('');
  const [headmasterNip, setHeadmasterNip] = useState('');
  const [reportCity, setReportCity] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [reportFooterNote, setReportFooterNote] = useState('');

  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationContent, setNotificationContent] = useState('');
  const [isNotificationActive, setIsNotificationActive] = useState(false);
  const [notificationInterval, setNotificationInterval] = useState(3);

  const [isAudioSaving, setIsAudioSaving] = useState(false);
  const [successSoundBase64, setSuccessSoundBase64] = useState<string | null>(null);
  const [successSoundName, setSuccessSoundName] = useState<string>('');
  const [isAudioConfirmOpen, setIsAudioConfirmOpen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const schoolConfigRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'schoolConfig', 'default');
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<{ 
      name: string;
      role: string;
      email: string;
      nip?: string;
      nisn?: string;
      position?: string;
      photoURL?: string;
  }>(user, userDocRef);

  const { data: schoolConfigData, isLoading: isConfigLoading } = useDoc<{
      governmentAgency: string;
      educationAgency: string;
      schoolName: string;
      address: string;
      headmasterName: string;
      headmasterNip: string;
      reportCity: string;
      academicYear: string;
      reportFooterNote?: string;
      notificationTitle?: string;
      notificationContent?: string;
      isNotificationActive?: boolean;
      notificationInterval?: number;
      successSoundUrl?: string;
      successSoundName?: string;
  }>(user, schoolConfigRef);

  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setNip(userData.nip || '');
      setNisn(userData.nisn || '');
      setPosition(userData.position || '');
    }
  }, [userData]);

  useEffect(() => {
    if (schoolConfigData) {
      setGovernmentAgency(schoolConfigData.governmentAgency ?? '');
      setEducationAgency(schoolConfigData.educationAgency ?? '');
      setSchoolName(schoolConfigData.schoolName ?? '');
      setAddress(schoolConfigData.address ?? '');
      setHeadmasterName(schoolConfigData.headmasterName ?? '');
      setHeadmasterNip(schoolConfigData.headmasterNip ?? '');
      setReportCity(schoolConfigData.reportCity ?? '');
      setAcademicYear(schoolConfigData.academicYear ?? '');
      setReportFooterNote(schoolConfigData.reportFooterNote ?? 'Dokumen absensi ini adalah dokumen resmi yang dibuat secara otomatis oleh aplikasi.');
      
      setNotificationTitle(schoolConfigData.notificationTitle ?? '');
      setNotificationContent(schoolConfigData.notificationContent ?? '');
      setIsNotificationActive(schoolConfigData.isNotificationActive ?? false);
      setNotificationInterval(schoolConfigData.notificationInterval ?? 3);
      setSuccessSoundBase64(schoolConfigData.successSoundUrl ?? null);
      setSuccessSoundName(schoolConfigData.successSoundName ?? '');
    }
  }, [schoolConfigData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsCroppingModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.size > 1024 * 1024) {
              toast({ variant: 'destructive', title: 'File terlalu besar', description: 'Ukuran audio maksimal adalah 1MB.' });
              return;
          }
          const reader = new FileReader();
          reader.onload = () => {
              setSuccessSoundBase64(reader.result as string);
              setSuccessSoundName(file.name);
              toast({ title: 'Audio dimuat', description: `File "${file.name}" siap disimpan.` });
          };
          reader.readAsDataURL(file);
      }
  };

  const playTestAudio = () => {
      if (!successSoundBase64) return;
      const audio = new Audio(successSoundBase64);
      audio.play().catch(e => {
          toast({ variant: 'destructive', title: 'Gagal memutar', description: 'Pastikan format file didukung.' });
      });
  };

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApplyCrop = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
        setPhotoPreview(croppedImage);
        setIsCroppingModalOpen(false);
        setImageToCrop(null);
        toast({ title: 'Berhasil dipotong', description: 'Foto Anda telah disesuaikan dan siap disimpan.' });
      } catch (e) {
        toast({ variant: 'destructive', title: 'Gagal memotong', description: 'Terjadi kesalahan saat memproses gambar.' });
      }
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUser = auth.currentUser;
    if (!rawUser || !userDocRef) return;
    setIsProfileLoading(true);

    try {
      const authUpdates: any = {};
      const firestoreUpdates: any = {};

      if (name.trim() && name !== userData?.name) {
          authUpdates.displayName = name;
          firestoreUpdates.name = name;
      }

      if (photoPreview) {
          authUpdates.photoURL = photoPreview;
          firestoreUpdates.photoURL = photoPreview;
      }

      if (userData?.role !== 'admin') {
          if (nip !== (userData?.nip || '')) firestoreUpdates.nip = nip;
          if (nisn !== (userData?.nisn || '')) firestoreUpdates.nisn = nisn;
          if (position !== (userData?.position || '')) firestoreUpdates.position = position;
      }

      const updatePromises: Promise<any>[] = [];
      if (Object.keys(authUpdates).length > 0) {
          updatePromises.push(updateProfile(rawUser, authUpdates));
      }
      if (Object.keys(firestoreUpdates).length > 0) {
          updatePromises.push(setDoc(userDocRef, firestoreUpdates, { merge: true }));
      }
      
      if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          invalidateCache();
          toast({ title: 'Berhasil', description: 'Profil telah diperbarui.' });
      } else {
          toast({ title: 'Info', description: 'Tidak ada perubahan data.' });
      }
      setPhotoPreview(null);
    } catch (error: any) {
      console.error("Update Profile Error:", error);
      toast({ variant: 'destructive', title: 'Gagal', description: error.message });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUser = auth.currentUser;
    if (!rawUser) return;
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Konfirmasi password tidak cocok.' });
      return;
    }
    setIsPasswordLoading(true);
    try {
      await updatePassword(rawUser, newPassword);
      toast({ title: 'Berhasil', description: 'Password telah diubah.' });
      setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Silakan login ulang untuk keamanan.' });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleReportSettingsSave = () => {
    if (!schoolConfigRef) return;
    setIsReportSaving(true);
    setDocumentNonBlocking(schoolConfigRef, {
      governmentAgency, educationAgency, schoolName, address, headmasterName, headmasterNip, reportCity, academicYear, reportFooterNote
    }, { merge: true });
    toast({ title: 'Disimpan', description: 'Data laporan diperbarui.' });
    setIsReportSaving(false);
  };

  const handleNotificationSettingsSave = () => {
    if (!schoolConfigRef) return;
    setIsNotificationSaving(true);
    setDocumentNonBlocking(schoolConfigRef, {
      notificationTitle, notificationContent, isNotificationActive, notificationInterval: Number(notificationInterval),
    }, { merge: true });
    toast({ title: 'Disimpan', description: 'Pengumuman diperbarui.' });
    setIsNotificationSaving(false);
  };

  const handleAudioSettingsSave = () => {
      if (!schoolConfigRef) return;
      setIsAudioSaving(true);
      updateDocumentNonBlocking(schoolConfigRef, {
          successSoundUrl: successSoundBase64,
          successSoundName: successSoundName
      });
      toast({ title: 'Nada Diperbarui', description: 'Nada konfirmasi keberhasilan absen telah disimpan.' });
      setIsAudioSaving(false);
  };

  const getInitials = (n: string | null) => n ? n.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase() : 'U';
  const currentPhoto = photoPreview || userData?.photoURL;
  const isTeacherOrStaff = ['guru', 'pegawai', 'kepala_sekolah'].includes(userData?.role || '');
  const isAdmin = userData?.role === 'admin';
  const positions = isTeacherOrStaff ? ["PNS", "PPPK", "Honorer", "PW"] : ["Pelajar Aktif"];

  if (isUserDataLoading || isAuthLoading || isConfigLoading) return <div className="flex h-full items-center justify-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="flex-1 pt-2 pb-24 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="px-4 md:px-0">
          <h1 className="text-2xl font-black tracking-tight text-foreground">Pengaturan</h1>
          <p className="text-muted-foreground mt-0.5 text-xs font-bold">Kelola profil dan konfigurasi aplikasi.</p>
        </div>

        <form onSubmit={handleProfileUpdate}>
          <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl bg-card">
            <CardHeader className="p-6 bg-muted/20 border-b border-muted-foreground/5">
              <div className="flex items-center gap-3">
                <UserCircle className="h-5 w-5 text-primary" />
                <CardTitle className="font-bold text-sm uppercase tracking-tight">Profil Pengguna</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 pt-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-2 border-primary/10 shadow-xl">
                      <AvatarImage src={currentPhoto ?? undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/5 text-primary font-bold text-xl">{getInitials(name)}</AvatarFallback>
                    </Avatar>
                    <Button type="button" size="icon" variant="outline" className="absolute -bottom-1 -right-1 rounded-full h-8 w-8 bg-primary text-white border-none shadow-lg active:scale-95 transition-all" onClick={() => fileInputRef.current?.click()}>
                      <Camera className="h-4 w-4" />
                    </Button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                  <div className="text-center sm:text-left space-y-1">
                     <h3 className="font-bold text-xl text-primary tracking-tight">{name || 'User'}</h3>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{userData?.role.replace('_', ' ')}</p>
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nama Lengkap</Label>
                      <Input className="h-12 rounded-xl bg-muted/30 font-bold shadow-none border-muted-foreground/10 focus:bg-background transition-all" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</Label>
                      <Input className="h-12 rounded-xl bg-muted/50 font-bold opacity-60 shadow-none border-dashed" value={userData?.email} readOnly />
                  </div>
                  {isTeacherOrStaff && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">NIP</Label>
                        <Input className="h-12 rounded-xl bg-muted/30 font-bold shadow-none border-muted-foreground/10" value={nip} onChange={(e) => setNip(e.target.value)} />
                    </div>
                  )}
                  {userData?.role === 'siswa' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">NISN</Label>
                        <Input className="h-12 rounded-xl bg-muted/30 font-bold shadow-none border-muted-foreground/10" value={nisn} onChange={(e) => setNisn(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Status Kepegawaian</Label>
                      <Select onValueChange={setPosition} value={position}>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/30 font-bold shadow-none border-muted-foreground/10">
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                            {positions.map(p => <SelectItem key={p} value={p} className="rounded-lg">{p}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-5 bg-muted/5">
              <Button type="submit" className="font-black rounded-xl h-12 px-10 shadow-none active:scale-95 transition-all bg-primary" disabled={isProfileLoading}>
                {isProfileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                SIMPAN PROFIL
              </Button>
            </CardFooter>
          </Card>
        </form>

        {isAdmin && (
          <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl">
              <CardHeader className="p-6 bg-muted/20 border-b border-muted-foreground/5">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="font-bold text-sm uppercase tracking-tight">Kop Laporan & Tanda Tangan PDF</CardTitle>
                  </div>
                  <CardDescription className="text-[10px] font-bold text-muted-foreground">Sesuaikan detail yang muncul pada header dan blok tanda tangan hasil unduh PDF.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Instansi Pemerintah</Label>
                        <Input placeholder="Contoh: PEMERINTAH KABUPATEN..." value={governmentAgency} onChange={e => setGovernmentAgency(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Dinas Terkait</Label>
                        <Input placeholder="Contoh: DINAS PENDIDIKAN..." value={educationAgency} onChange={e => setEducationAgency(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nama Lengkap Sekolah (Huruf Besar)</Label>
                        <Input placeholder="Nama Sekolah" value={schoolName} onChange={e => setSchoolName(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Alamat Sekolah Lengkap</Label>
                        <Input placeholder="Alamat Lengkap" value={address} onChange={e => setAddress(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nama Kepala Sekolah & Gelar</Label>
                        <Input placeholder="Nama Kepsek" value={headmasterName} onChange={e => setHeadmasterName(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">NIP Kepala Sekolah</Label>
                        <Input placeholder="NIP Kepsek" value={headmasterNip} onChange={e => setHeadmasterNip(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Kota Laporan (Lokasi TTD)</Label>
                        <Input placeholder="Contoh: Mando" value={reportCity} onChange={e => setReportCity(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tahun Ajaran Aktif</Label>
                        <Input placeholder="Contoh: 2025/2026" value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Catatan Footer PDF (Keterangan Bawah)</Label>
                        <Textarea placeholder="Teks yang muncul di bagian paling bawah PDF..." value={reportFooterNote} onChange={e => setReportFooterNote(e.target.value)} className="rounded-xl bg-muted/30 shadow-none min-h-[80px] font-medium" />
                      </div>
                  </div>
                  
                  <div className="pt-8 border-t mt-6">
                      <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <BellRing className="h-5 w-5 text-amber-500" />
                            <div>
                                <Label className="font-bold text-xs uppercase tracking-widest">Pengumuman Sistem</Label>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Pesan ini akan muncul di dashboard semua pengguna.</p>
                            </div>
                          </div>
                          <Switch checked={isNotificationActive} onCheckedChange={setIsNotificationActive} />
                      </div>
                      <div className="space-y-4">
                        <Input placeholder="Judul Pengumuman" value={notificationTitle} onChange={e => setNotificationTitle(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none font-bold" />
                        <Textarea placeholder="Tuliskan isi pesan atau kutipan motivasi di sini..." value={notificationContent} onChange={e => setNotificationContent(e.target.value)} className="rounded-xl bg-muted/30 shadow-none min-h-[100px] font-medium" />
                      </div>
                  </div>

                  <div className="pt-8 border-t mt-6">
                      <div className="flex items-center gap-3 mb-4">
                          <Volume2 className="h-5 w-5 text-primary" />
                          <div>
                              <Label className="font-bold text-xs uppercase tracking-widest">Nada Konfirmasi Absensi</Label>
                              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Unggah suara kustom (Maks 1MB).</p>
                          </div>
                      </div>
                      <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-2xl border border-muted-foreground/10">
                          <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nada Aktif:</span>
                                  <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">{successSoundName || 'Default (Tinggggg)'}</span>
                              </div>
                              <div className="flex gap-2">
                                  {successSoundBase64 && (
                                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg shadow-none flex items-center gap-2 font-bold text-[10px]" onClick={playTestAudio}>
                                          <Play className="h-3 w-3 fill-primary text-primary" /> TEST
                                      </Button>
                                  )}
                                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg shadow-none border-primary/20 hover:bg-primary/5 font-bold text-[10px] uppercase" onClick={() => successSoundBase64 ? setIsAudioConfirmOpen(true) : audioInputRef.current?.click()}>
                                      Ganti nada
                                  </Button>
                              </div>
                          </div>
                          <input 
                              type="file" 
                              ref={audioInputRef}
                              accept="audio/mp3,audio/wav,audio/ogg" 
                              className="hidden" 
                              onChange={handleAudioFileChange}
                          />
                      </div>
                  </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-5 bg-muted/5 flex flex-wrap gap-3">
                  <Button onClick={handleReportSettingsSave} disabled={isReportSaving} className="font-bold rounded-xl h-11 px-6 shadow-none">SIMPAN DATA PDF</Button>
                  <Button onClick={handleNotificationSettingsSave} disabled={isNotificationSaving} variant="outline" className="font-bold rounded-xl h-11 px-6 shadow-none border-muted-foreground/20">UPDATE PENGUMUMAN</Button>
                  <Button onClick={handleAudioSettingsSave} disabled={isAudioSaving} variant="secondary" className="font-bold rounded-xl h-11 px-6 shadow-none bg-primary/10 text-primary hover:bg-primary/20">SIMPAN NADA</Button>
              </CardFooter>
          </Card>
        )}

        <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl">
          <CardHeader className="p-6 bg-muted/20 border-b border-muted-foreground/5">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="font-bold text-sm uppercase tracking-tight">Ganti Password</CardTitle>
            </div>
          </CardHeader>
          <form onSubmit={handlePasswordChange}>
            <CardContent className="grid gap-5 pt-8">
                <div className="relative">
                  <Input type={showNewPass ? "text" : "password"} className="h-12 rounded-xl bg-muted/30 pr-12 font-bold shadow-none border-muted-foreground/10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password Baru" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent shadow-none" onClick={() => setShowNewPass(!showNewPass)}>
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="relative">
                  <Input type={showConfirmPass ? "text" : "password"} className="h-12 rounded-xl bg-muted/30 pr-12 font-bold shadow-none border-muted-foreground/10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Konfirmasi Password Baru" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent shadow-none" onClick={() => setShowConfirmPass(!showConfirmPass)}>
                    {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-5 bg-muted/5">
              <Button type="submit" className="font-black rounded-xl h-12 px-8 shadow-none active:scale-95 transition-all bg-primary" disabled={isPasswordLoading}>
                {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                GANTI PASSWORD
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <AlertDialog open={isAudioConfirmOpen} onOpenChange={setIsAudioConfirmOpen}>
          <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
              <AlertDialogHeader>
                  <div className="flex items-center gap-3 text-amber-500 mb-2">
                      <AlertTriangle className="h-6 w-6" />
                      <AlertDialogTitle className="text-xl font-bold">Ganti nada konfirmasi?</AlertDialogTitle>
                  </div>
                  <AlertDialogDescription className="text-sm font-medium">
                      Anda akan mengganti nada absensi yang sudah tersimpan sebelumnya. Apakah Anda yakin ingin memilih file audio baru?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 gap-2">
                  <AlertDialogCancel className="h-11 rounded-xl font-bold border-muted-foreground/10 shadow-none">Batal</AlertDialogCancel>
                  <AlertDialogAction className="h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-none" onClick={() => { setIsAudioConfirmOpen(false); audioInputRef.current?.click(); }}>
                      Ya, Pilih File Baru
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCroppingModalOpen} onOpenChange={setIsCroppingModalOpen}>
          <DialogContent className="max-w-2xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="p-6 bg-primary text-white">
                  <DialogTitle className="flex items-center gap-3 font-black tracking-tight text-xl">
                      <Scissors className="h-5 w-5" /> Atur Tata Letak Foto
                  </DialogTitle>
                  <DialogDescription className="text-white/80 font-bold text-xs mt-1">
                      Geser dan perbesar gambar untuk menyesuaikan posisi profil yang pas.
                  </DialogDescription>
              </DialogHeader>
              <div className="relative h-[400px] w-full bg-slate-900">
                  {imageToCrop && (
                      <Cropper
                          image={imageToCrop}
                          crop={crop}
                          zoom={zoom}
                          aspect={1 / 1}
                          onCropChange={setCrop}
                          onCropComplete={onCropComplete}
                          onZoomChange={setZoom}
                          cropShape="round"
                          showGrid={false}
                      />
                  )}
              </div>
              <div className="p-6 bg-muted/30 flex flex-col gap-4">
                  <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                          <span>Zoom</span>
                          <span>{Math.round(zoom * 100)}%</span>
                      </div>
                      <input 
                          type="range" 
                          min={1} 
                          max={3} 
                          step={0.1} 
                          value={zoom} 
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-full h-2 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="ghost" className="rounded-xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setIsCroppingModalOpen(false)}>Batal</Button>
                      <Button className="rounded-xl font-black px-8 bg-primary uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-95 transition-all" onClick={handleApplyCrop}>
                          <Check className="mr-2 h-4 w-4" /> Gunakan Foto Ini
                      </Button>
                  </DialogFooter>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  )
}
