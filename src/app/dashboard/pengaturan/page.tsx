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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth, setDocumentNonBlocking } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, Camera, Eye, EyeOff, UserCircle, Settings2, BellRing, KeyRound } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updatePassword, updateProfile } from 'firebase/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { invalidateCache } from '@/lib/cache';

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

  const [isReportSaving, setIsReportSaving] = useState(false);
  const [governmentAgency, setGovernmentAgency] = useState('');
  const [educationAgency, setEducationAgency] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [headmasterName, setHeadmasterName] = useState('');
  const [headmasterNip, setHeadmasterNip] = useState('');
  const [reportCity, setReportCity] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationContent, setNotificationContent] = useState('');
  const [isNotificationActive, setIsNotificationActive] = useState(false);
  const [notificationInterval, setNotificationInterval] = useState(3);

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
      notificationTitle?: string;
      notificationContent?: string;
      isNotificationActive?: boolean;
      notificationInterval?: number;
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
      
      setNotificationTitle(schoolConfigData.notificationTitle ?? '');
      setNotificationContent(schoolConfigData.notificationContent ?? '');
      setIsNotificationActive(schoolConfigData.isNotificationActive ?? false);
      setNotificationInterval(schoolConfigData.notificationInterval ?? 3);
    }
  }, [schoolConfigData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 750 * 1024) {
          toast({ variant: 'destructive', title: 'File terlalu besar', description: 'Maksimal 750KB.' });
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
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
      governmentAgency, educationAgency, schoolName, address, headmasterName, headmasterNip, reportCity, academicYear,
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
                      <AvatarImage src={currentPhoto ?? undefined} />
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
                    <Settings2 className="h-5 w-5 text-primary" />
                    <CardTitle className="font-bold text-sm uppercase tracking-tight">Kop Laporan & Pengumuman</CardTitle>
                  </div>
              </CardHeader>
              <CardContent className="grid gap-4 pt-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Instansi Pemerintah</Label>
                        <Input placeholder="Contoh: PEMERINTAH KABUPATEN..." value={governmentAgency} onChange={e => setGovernmentAgency(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Dinas Terkait</Label>
                        <Input placeholder="Contoh: DINAS PENDIDIKAN..." value={educationAgency} onChange={e => setEducationAgency(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nama Lengkap Sekolah</Label>
                        <Input placeholder="Nama Sekolah" value={schoolName} onChange={e => setSchoolName(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nama Kepala Sekolah</Label>
                        <Input placeholder="Nama Kepsek" value={headmasterName} onChange={e => setHeadmasterName(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">NIP Kepala Sekolah</Label>
                        <Input placeholder="NIP Kepsek" value={headmasterNip} onChange={e => setHeadmasterNip(e.target.value)} className="h-11 rounded-xl bg-muted/30 shadow-none" />
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
              </CardContent>
              <CardFooter className="border-t px-6 py-5 bg-muted/5 gap-3">
                  <Button onClick={handleReportSettingsSave} disabled={isReportSaving} className="font-bold rounded-xl h-11 px-6 shadow-none">Simpan Kop Laporan</Button>
                  <Button onClick={handleNotificationSettingsSave} disabled={isNotificationSaving} variant="outline" className="font-bold rounded-xl h-11 px-6 shadow-none border-muted-foreground/20">Update Pengumuman</Button>
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
    </div>
  )
}