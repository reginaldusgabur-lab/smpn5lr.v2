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
import { useUser, useDoc, useFirestore, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Camera, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updatePassword, updateProfile } from 'firebase/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function PengaturanPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // State for password change
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // State for profile update
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [name, setName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for report settings
  const [isReportSaving, setIsReportSaving] = useState(false);
  const [governmentAgency, setGovernmentAgency] = useState('');
  const [educationAgency, setEducationAgency] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [headmasterName, setHeadmasterName] = useState('');
  const [headmasterNip, setHeadmasterNip] = useState('');
  const [reportCity, setReportCity] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  // Firestore refs
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const schoolConfigRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'schoolConfig', 'default');
  }, [firestore, user]);

  // Data fetching hooks
  const { data: userData, isLoading: isUserDataLoading } = useDoc<{ 
      name: string;
      role: string;
      email: string;
      nip?: string;
      nisn?: string;
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
  }>(user, schoolConfigRef);

  // Populate state from fetched data
  useEffect(() => {
    if (userData?.name) {
      setName(userData.name);
    }
  }, [userData?.name]);

  useEffect(() => {
    if (schoolConfigData) {
      setGovernmentAgency(schoolConfigData.governmentAgency ?? 'PEMERINTAH KABUPATEN MANGGARAI');
      setEducationAgency(schoolConfigData.educationAgency ?? 'DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA');
      setSchoolName(schoolConfigData.schoolName ?? 'SMP NEGERI 5 LANGKE REMBONG');
      setAddress(schoolConfigData.address ?? 'Jl. Ranaka, Karot, Langke Rembong, Kabupaten Manggarai, Nusa Tenggara Tim.');
      setHeadmasterName(schoolConfigData.headmasterName ?? 'Fransiskus Sales, S.Pd');
      setHeadmasterNip(schoolConfigData.headmasterNip ?? '196805121994121004');
      setReportCity(schoolConfigData.reportCity ?? 'Mando');
      setAcademicYear(schoolConfigData.academicYear ?? '');
    }
  }, [schoolConfigData]);

  const getIdentifier = () => {
    if (!userData) return null;
    switch(userData.role) {
      case 'guru':
      case 'kepala_sekolah':
        return { label: 'NIP', value: userData.nip };
      case 'siswa':
        return { label: 'NISN', value: userData.nisn };
      default:
        return null;
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 750 * 1024) {
          toast({
              variant: 'destructive',
              title: 'File Terlalu Besar',
              description: 'Ukuran foto profil tidak boleh melebihi 750KB.',
          });
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userDocRef) return;
    setIsProfileLoading(true);

    try {
      const authUpdates: { displayName?: string } = {};
      const firestoreUpdates: { name?: string; photoURL?: string } = {};

      if (name && name !== (user.displayName || userData?.name)) {
        authUpdates.displayName = name;
        firestoreUpdates.name = name;
      }
      if (photoPreview) {
        firestoreUpdates.photoURL = photoPreview;
      }

      const updatePromises: Promise<any>[] = [];
      if (Object.keys(authUpdates).length > 0) {
        updatePromises.push(updateProfile(user, authUpdates));
      }
      if (Object.keys(firestoreUpdates).length > 0) {
        updatePromises.push(updateDoc(userDocRef, firestoreUpdates));
      }
      
      if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          toast({
            title: 'Berhasil',
            description: 'Profil Anda telah berhasil diperbarui.',
          });
      }
      
      setPhotoPreview(null);
    } catch (error: any) {
      console.error("Profile update error", error);
      let description = 'Terjadi kesalahan. Ukuran file foto mungkin terlalu besar atau format tidak didukung.';
      if (error.code === 'auth/requires-recent-login') {
          description = 'Sesi Anda sudah terlalu lama. Untuk keamanan, silakan logout dan login kembali.';
      }
      toast({
        variant: 'destructive',
        title: 'Gagal Memperbarui Profil',
        description: description,
      });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Konfirmasi password baru tidak cocok.' });
      return;
    }
    if (newPassword.length < 6) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Password baru minimal harus 6 karakter.' });
        return;
    }
    setIsPasswordLoading(true);
    if (user) {
      try {
        await updatePassword(user, newPassword);
        toast({ title: 'Berhasil', description: 'Password Anda telah berhasil diubah.' });
        setNewPassword('');
        setConfirmPassword('');
      } catch (error: any) {
        console.error("Password change error", error);
        let description = 'Terjadi kesalahan yang tidak diketahui. Coba lagi nanti.';
        if (error.code === 'auth/requires-recent-login') {
            description = 'Sesi Anda sudah terlalu lama. Untuk keamanan, silakan logout dan login kembali sebelum mencoba mengubah password.';
        }
        toast({ 
            variant: 'destructive', 
            title: 'Gagal Mengubah Password', 
            description: description,
            duration: 9000,
        });
      } finally {
        setIsPasswordLoading(false);
      }
    }
  };

  const handleReportSettingsSave = () => {
    if (!schoolConfigRef) return;
    setIsReportSaving(true);
    setDocumentNonBlocking(schoolConfigRef, {
      governmentAgency,
      educationAgency,
      schoolName,
      address,
      headmasterName,
      headmasterNip,
      reportCity,
      academicYear,
    }, { merge: true });
    toast({
      title: 'Pengaturan Disimpan',
      description: 'Informasi laporan PDF telah berhasil diperbarui.',
    });
    setIsReportSaving(false);
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  const isLoading = isUserDataLoading || isAuthLoading || isConfigLoading;
  const isAdmin = userData?.role === 'admin';
  const currentPhoto = photoPreview || userData?.photoURL || user?.photoURL;
  const identifierInfo = getIdentifier();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleProfileUpdate}>
        <Card className="overflow-hidden bg-card border shadow-xl rounded-3xl">
          <CardHeader className="p-6 text-primary border-b border-muted-foreground/10">
            <CardTitle className="font-black text-xs uppercase tracking-widest">PROFIL PENGGUNA</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
              Informasi dasar akun yang ditampilkan di aplikasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 pt-6">
            <div className="flex items-center gap-4 sm:gap-6">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20 shadow-lg">
                    <AvatarImage src={currentPhoto ?? undefined} alt="User Avatar" />
                    <AvatarFallback>{getInitials(name)}</AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-1 -right-1 rounded-full h-8 w-8 border-2 bg-background hover:bg-muted shadow-md"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    <span className="sr-only">Ganti Foto</span>
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="space-y-1">
                   <Label className="font-black text-sm uppercase tracking-wider text-primary">Foto Profil</Label>
                   <p className="text-[10px] font-bold text-muted-foreground">
                      PNG, JPG, GIF (Maks 750KB). <br className="hidden sm:block" />
                      Klik kamera untuk ubah.
                  </p>
                </div>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-bold ml-1">Nama Lengkap</Label>
                    <Input id="fullName" className="h-11 rounded-xl bg-muted/30" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="role" className="text-xs font-bold ml-1">Peran</Label>
                    <Input id="role" className="h-11 rounded-xl bg-muted/40 font-bold" value={userData?.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1).replace('_', ' ') : ''} readOnly />
                </div>
            </div>
            <div className={`grid grid-cols-1 ${identifierInfo ? 'sm:grid-cols-2' : ''} gap-4`}>
                <div className={`space-y-2 ${!identifierInfo ? 'sm:col-span-2' : ''}`}>
                    <Label htmlFor="email" className="text-xs font-bold ml-1">Alamat Email</Label>
                    <Input id="email" type="email" className="h-11 rounded-xl bg-muted/40" value={userData?.email || ''} readOnly />
                </div>
                {identifierInfo && (
                  <div className="space-y-2">
                      <Label htmlFor="identifier" className="text-xs font-bold ml-1">{identifierInfo.label}</Label>
                      <Input id="identifier" className="h-11 rounded-xl bg-muted/40" value={identifierInfo.value || ''} readOnly />
                  </div>
                )}
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-muted/5">
            <Button type="submit" className="font-black rounded-xl h-11 shadow-lg" disabled={isProfileLoading}>
              <span className="flex items-center justify-center">
                {isProfileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                SIMPAN PROFIL
              </span>
            </Button>
          </CardFooter>
        </Card>
      </form>
      
      {isAdmin && (
         <Card className="overflow-hidden bg-card border shadow-xl rounded-3xl">
            <CardHeader className="p-6 text-primary border-b border-muted-foreground/10">
                <CardTitle className="font-black text-xs uppercase tracking-widest">PENGATURAN LAPORAN PDF</CardTitle>
                <CardDescription className="text-muted-foreground font-medium">Informasi resmi untuk kop dan footer laporan PDF.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6">
                <div className="space-y-2">
                    <Label htmlFor="government-agency" className="text-xs font-bold ml-1">Instansi Pemerintah</Label>
                    <Input id="government-agency" className="h-11 rounded-xl bg-muted/30" value={governmentAgency} onChange={e => setGovernmentAgency(e.target.value)} placeholder="PEMERINTAH KABUPATEN MANGGARAI" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="education-agency" className="text-xs font-bold ml-1">Dinas Pendidikan</Label>
                    <Input id="education-agency" className="h-11 rounded-xl bg-muted/30" value={educationAgency} onChange={e => setEducationAgency(e.target.value)} placeholder="DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="school-name" className="text-xs font-bold ml-1">Nama Sekolah</Label>
                    <Input id="school-name" className="h-11 rounded-xl bg-muted/30" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="SMP NEGERI 5 LANGKE REMBONG" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="address" className="text-xs font-bold ml-1">Alamat Sekolah</Label>
                    <Input id="address" className="h-11 rounded-xl bg-muted/30" value={address} onChange={e => setAddress(e.target.value)} placeholder="Jl. Ranaka, Karot, Langke Rembong..." />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="report-city" className="text-xs font-bold ml-1">Kota Laporan</Label>
                        <Input id="report-city" className="h-11 rounded-xl bg-muted/30" value={reportCity} onChange={e => setReportCity(e.target.value)} placeholder="Contoh: Mando" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="headmaster-name" className="text-xs font-bold ml-1">Nama Kepala Sekolah</Label>
                        <Input id="headmaster-name" className="h-11 rounded-xl bg-muted/30" value={headmasterName} onChange={e => setHeadmasterName(e.target.value)} placeholder="Fransiskus Sales, S.Pd" />
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="headmaster-nip" className="text-xs font-bold ml-1">NIP Kepala Sekolah</Label>
                        <Input id="headmaster-nip" className="h-11 rounded-xl bg-muted/30" value={headmasterNip} onChange={e => setHeadmasterNip(e.target.value)} placeholder="196805121994121004" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="academic-year" className="text-xs font-bold ml-1">Tahun Ajaran</Label>
                        <Input id="academic-year" className="h-11 rounded-xl bg-muted/30" value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="Contoh: 2025/2026" />
                    </div>
                 </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4 bg-muted/5">
                <Button onClick={handleReportSettingsSave} className="font-black rounded-xl h-11 shadow-lg" disabled={isReportSaving}>
                  <span className="flex items-center justify-center">
                    {isReportSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    SIMPAN DATA LAPORAN
                  </span>
                </Button>
            </CardFooter>
        </Card>
      )}

      <Card className="overflow-hidden bg-card border shadow-xl rounded-3xl">
        <CardHeader className="p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-black text-xs uppercase tracking-widest">GANTI KATA SANDI</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            Gunakan kombinasi password yang kuat untuk keamanan akun.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordChange}>
          <CardContent className="grid gap-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-bold ml-1">Password Baru</Label>
                <div className="relative">
                  <Input id="new-password" type={showNewPass ? "text" : "password"} className="h-11 rounded-xl bg-muted/30 pr-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" />
                  <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowNewPass(!showNewPass)}
                  >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">Tampilkan password</span>
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-bold ml-1">Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input id="confirm-password" type={showConfirmPass ? "text" : "password"} className="h-11 rounded-xl bg-muted/30 pr-10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password baru" />
                   <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                  >
                      {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">Tampilkan password</span>
                  </Button>
                </div>
              </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-muted/5">
            <Button type="submit" className="font-black rounded-xl h-11 shadow-lg" disabled={isPasswordLoading}>
              <span className="flex items-center justify-center">
                {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                SIMPAN PASSWORD
              </span>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
