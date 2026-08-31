'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  Loader2,
  Search,
  Filter,
  Edit2,
  Trash2,
  KeyRound,
  Users as UsersIcon,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, collection } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { resetUserPassword } from '@/app/actions/admin-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

const addUserSchema = z.object({
    name: z.string().min(1, { message: 'Nama wajib diisi' }),
    email: z.string().email({ message: 'Email tidak valid.' }),
    role: z.enum(['guru', 'pegawai', 'kepala_sekolah', 'admin', 'siswa']),
    gender: z.enum(['Laki-laki', 'Perempuan'], { required_error: 'Jenis kelamin wajib dipilih' }),
    nip: z.string().optional(),
    nisn: z.string().optional(),
    position: z.string().optional(),
    sequenceNumber: z.string().optional(),
    password: z.string().optional().refine((val) => !val || val.length >= 6, {
      message: 'Password minimal 6 karakter.'
    }),
});

export default function AdminUsersPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    
    const [userFilter, setUserFilter] = useState('all');
    const [userSearch, setUserSearch] = useState('');
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isResetPassDialogOpen, setIsResetPassDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const [userForReset, setUserForReset] = useState<any | null>(null);
    const [newPassInput, setNewPassInput] = useState('');

    const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: usersData, isLoading: isUsersLoading } = useCollection(user, usersRef);

    const filteredUsers = useMemo(() => {
        if (!usersData) return [];
        return usersData.filter(u => {
            const matchRole = userFilter === 'all' ? true : u.role === userFilter;
            const matchSearch = (u.name || '').toLowerCase().includes(userSearch.toLowerCase());
            return matchRole && matchSearch;
        }).sort((a, b) => (a.sequenceNumber ?? 999) - (b.sequenceNumber ?? 999));
    }, [usersData, userFilter, userSearch]);

    const userStats = useMemo(() => {
        return filteredUsers.reduce((acc, curr) => {
            // JANGAN HITUNG ADMIN AGAR TAU PENGGUNA AKTIF SAJA
            if (curr.role === 'admin') return acc;
            
            acc.total++;
            if (curr.gender === 'Laki-laki') acc.lakiLaki++;
            else if (curr.gender === 'Perempuan') acc.perempuan++;
            return acc;
        }, { total: 0, lakiLaki: 0, perempuan: 0 });
    }, [filteredUsers]);

    const userForm = useForm<z.infer<typeof addUserSchema>>({
        resolver: zodResolver(addUserSchema),
        defaultValues: { role: 'guru', gender: 'Laki-laki', name: '', email: '', nip: '', nisn: '', position: '', sequenceNumber: '', password: '' },
    });

    useEffect(() => {
        if (editingUser) {
            userForm.reset({
                name: editingUser.name || '',
                email: editingUser.email || '',
                role: editingUser.role || 'guru',
                gender: editingUser.gender || 'Laki-laki',
                nip: editingUser.nip || '',
                nisn: editingUser.nisn || '',
                position: editingUser.position || '',
                sequenceNumber: editingUser.sequenceNumber?.toString() || '',
                password: '',
            });
        } else {
            userForm.reset({ role: 'guru', gender: 'Laki-laki', name: '', email: '', nip: '', nisn: '', position: '', sequenceNumber: '', password: '' });
        }
    }, [editingUser, userForm]);

    const handleSaveUser = async (values: z.infer<typeof addUserSchema>) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const parsedSeq = values.sequenceNumber ? parseInt(values.sequenceNumber, 10) : null;
            const finalSeq = (parsedSeq !== null && !isNaN(parsedSeq)) ? parsedSeq : null;

            if (editingUser) {
                const userRef = doc(firestore, "users", editingUser.id);
                updateDocumentNonBlocking(userRef, {
                    name: values.name,
                    role: values.role,
                    gender: values.gender,
                    nip: values.nip || null,
                    nisn: values.nisn || null,
                    position: values.position || null,
                    sequenceNumber: finalSeq,
                });
                toast({ title: 'Berhasil', description: 'Data pengguna diperbarui.' });
                setIsUserDialogOpen(false);
            } else {
                if (!values.password) throw new Error("Password wajib diisi.");
                const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
                try {
                    const cred = await createUserWithEmailAndPassword(getAuth(tempApp), values.email, values.password);
                    setDocumentNonBlocking(doc(firestore, "users", cred.user.uid), {
                        id: cred.user.uid, 
                        name: values.name, 
                        role: values.role, 
                        gender: values.gender,
                        email: values.email, 
                        status: 'Aktif', 
                        nip: values.nip || null, 
                        nisn: values.nisn || null,
                        position: values.position || null, 
                        sequenceNumber: finalSeq,
                    }, {});
                    toast({ title: 'Berhasil', description: 'Akun baru telah dibuat.' });
                    setIsUserDialogOpen(false);
                } finally { 
                    await deleteApp(tempApp); 
                }
            }
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Kesalahan', description: e.message }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete || !firestore) return;
        setIsSaving(true);
        try {
            const userRef = doc(firestore, "users", userToDelete.id);
            deleteDocumentNonBlocking(userRef);
            toast({ title: 'Berhasil', description: 'Pengguna telah dihapus.' });
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleManualResetPassword = async () => {
        if (!userForReset || newPassInput.length < 6) return;
        setIsSaving(true);
        try {
            const result = await resetUserPassword(userForReset.id, newPassInput);
            if (result.success) {
                toast({ title: 'Berhasil', description: `Kata sandi ${userForReset.name} diperbarui.` });
                setIsResetPassDialogOpen(false);
                setNewPassInput('');
            } else { 
                throw new Error(result.error); 
            }
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Gagal', description: e.message }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    if (isAuthLoading || isUsersLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12"><UsersIcon className="w-24 h-24 text-white" /></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm"><UsersIcon className="h-6 w-6" /></div>
                                <div className="space-y-0.5"><h1 className="font-bold text-2xl tracking-tight">Manajemen pengguna</h1><p className="text-[11px] font-medium text-white/80">Kelola data personil sekolah.</p></div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10 shadow-none" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </Card>

                <Button size="lg" className="w-full font-bold rounded-xl h-12 shadow-lg shadow-primary/20 bg-primary" onClick={() => { setEditingUser(null); setIsUserDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-5 w-5" />Tambah personil
                </Button>

                <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-card">
                    <CardHeader className="p-6 border-b border-muted-foreground/5"><CardTitle className="font-bold text-blue-600 text-sm">Daftar pengguna sistem</CardTitle></CardHeader>
                    <CardContent className="py-6">
                        <div className="flex flex-col gap-4 sm:flex-row mb-8">
                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger className="w-full sm:w-[240px] h-11 rounded-xl bg-muted/30 font-bold text-xs shadow-none">
                                    <Filter className="h-4 w-4 text-primary mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className='border-none shadow-2xl'>
                                    <SelectItem value="all" className="rounded-lg">Semua pengguna</SelectItem>
                                    <SelectItem value="guru" className="rounded-lg">Guru</SelectItem>
                                    <SelectItem value="pegawai" className="rounded-lg">Pegawai</SelectItem>
                                    <SelectItem value="kepala_sekolah" className="rounded-lg">Kepala Sekolah</SelectItem>
                                    <SelectItem value="siswa" className="rounded-lg">Siswa</SelectItem>
                                    <SelectItem value="admin" className="rounded-lg font-bold text-primary">Admin Utama</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative w-full sm:w-[320px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                <Input placeholder="Cari nama..." className="pl-10 h-11 rounded-xl bg-muted/30 font-bold text-xs shadow-none" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="border rounded-xl overflow-hidden border-muted-foreground/5">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px] uppercase">No</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Nama & email</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Peran</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Gender</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Identitas</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] uppercase">Status</TableHead>
                                        <TableHead className="text-right font-bold text-[10px] uppercase pr-6">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                                        <TableRow key={u.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                            <TableCell className="text-center font-bold text-muted-foreground text-sm">{u.sequenceNumber ?? i + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border border-muted-foreground/10 shadow-sm">
                                                        <AvatarImage src={u.photoURL} alt={u.name} className="object-cover" />
                                                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">{getInitials(u.name || '')}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{u.name}</span>
                                                        <span className="text-[10px] text-muted-foreground font-bold">{u.email}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="secondary" className="text-[9px] font-bold px-3">{u.role.replace('_', ' ')}</Badge></TableCell>
                                            <TableCell><span className="text-xs font-medium">{u.gender || '-'}</span></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="text-[10px] font-bold">{u.nip || u.nisn || '-'}</span><span className="text-[9px] font-bold text-primary uppercase">{u.position || '-'}</span></div></TableCell>
                                            <TableCell className="text-center"><Badge variant={u.status === 'Aktif' ? 'default' : 'destructive'} className="text-[9px] font-bold">{u.status}</Badge></TableCell>
                                            <TableCell className="text-right pr-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52 rounded-xl p-2 border-none shadow-2xl">
                                                        <DropdownMenuLabel className="text-[10px] uppercase">Aksi</DropdownMenuLabel>
                                                        <DropdownMenuItem className="rounded-lg" onClick={() => { setEditingUser(u); setIsUserDialogOpen(true); }}><Edit2 className="mr-3 h-4 w-4" />Ubah data</DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-lg" onClick={() => { setUserForReset(u); setIsResetPassDialogOpen(true); }}><KeyRound className="mr-3 h-4 w-4" />Reset sandi</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive rounded-lg" onClick={() => { setUserToDelete(u); setIsDeleteDialogOpen(true); }}><Trash2 className="mr-3 h-4 w-4" />Hapus akun</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-bold text-xs tracking-widest opacity-40">Data tidak ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-8 pt-8 border-t border-muted-foreground/10 grid grid-cols-3 gap-3">
                            <div className="bg-primary/5 p-4 rounded-2xl text-center border border-primary/5">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-2">Total Aktif</p>
                                <p className="text-2xl font-black text-primary leading-none">{userStats.total}</p>
                            </div>
                            <div className="bg-blue-500/5 p-4 rounded-2xl text-center border border-blue-500/10">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-2 text-blue-600">Laki-laki</p>
                                <p className="text-2xl font-black text-blue-600 leading-none">{userStats.lakiLaki}</p>
                            </div>
                            <div className="bg-pink-500/5 p-4 rounded-2xl text-center border border-pink-500/10">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-2 text-pink-600">Perempuan</p>
                                <p className="text-2xl font-black text-pink-600 leading-none">{userStats.perempuan}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if (!open) setEditingUser(null); }}>
                <DialogContent className="rounded-xl border-none max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                    <div className="p-6 pb-2 border-b border-muted-foreground/5"><DialogTitle className="text-xl font-bold">{editingUser ? 'Perbarui data personil' : 'Tambah personil baru'}</DialogTitle></div>
                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <Form {...userForm}>
                            <form onSubmit={userForm.handleSubmit(handleSaveUser)} className="space-y-4 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="name" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Nama Lengkap</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={userForm.control} name="email" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Alamat Email</FormLabel><FormControl><Input type="email" {...field} disabled={!!editingUser} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="role" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase">Peran Sistem</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 shadow-none">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className='border-none shadow-2xl'>
                                                    <SelectItem value="guru" className="rounded-lg">Guru</SelectItem>
                                                    <SelectItem value="pegawai" className="rounded-lg">Pegawai</SelectItem>
                                                    <SelectItem value="kepala_sekolah" className="rounded-lg">Kepala Sekolah</SelectItem>
                                                    <SelectItem value="siswa" className="rounded-lg">Siswa</SelectItem>
                                                    <SelectItem value="admin" className="rounded-lg font-bold text-primary">Admin Utama</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={userForm.control} name="gender" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase">Jenis Kelamin</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 shadow-none">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className='border-none shadow-2xl'>
                                                    <SelectItem value="Laki-laki" className="rounded-lg">Laki-laki</SelectItem>
                                                    <SelectItem value="Perempuan" className="rounded-lg">Perempuan</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="nip" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">NIP (Staf)</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={userForm.control} name="nisn" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">NISN (Siswa)</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="position" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Status/Jabatan</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={userForm.control} name="sequenceNumber" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">No. urut laporan</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                {!editingUser && <FormField control={userForm.control} name="password" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Kata sandi awal</FormLabel><FormControl><Input type="password" {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />}
                                <Button type="submit" className="w-full h-12 rounded-xl font-bold bg-primary shadow-none mt-4 uppercase" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Simpan data personil'}</Button>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setUserToDelete(null); }}>
                <AlertDialogContent className="rounded-xl border-none shadow-2xl"><AlertDialogHeader><AlertDialogTitle className="font-bold">Hapus pengguna?</AlertDialogTitle><AlertDialogDescription className="font-medium text-sm">Data <strong>{userToDelete?.name}</strong> akan dihapus permanen dari sistem.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold shadow-none">Batal</AlertDialogCancel><AlertDialogAction className="rounded-xl font-bold bg-destructive shadow-none uppercase" onClick={handleDeleteUser}>Ya, hapus permanen</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <Dialog open={isResetPassDialogOpen} onOpenChange={setIsResetPassDialogOpen}>
                <DialogContent className="rounded-xl border-none max-w-sm shadow-2xl">
                    <div className="space-y-4 p-4">
                        <DialogTitle className="font-bold text-xl uppercase text-primary">Reset kata sandi</DialogTitle>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Sandi baru untuk {userForReset?.name}</label>
                            <Input type="password" value={newPassInput} onChange={e => setNewPassInput(e.target.value)} placeholder="Minimal 6 karakter" className="h-11 rounded-xl bg-muted/30 shadow-none" />
                        </div>
                        <Button className="w-full h-11 rounded-xl font-bold shadow-none uppercase" onClick={handleManualResetPassword} disabled={isSaving || newPassInput.length < 6}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Perbarui Sandi'}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
