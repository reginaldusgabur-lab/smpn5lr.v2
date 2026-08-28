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

const addUserSchema = z.object({
    name: z.string().min(1, { message: 'Nama wajib diisi' }),
    email: z.string().email({ message: 'Email tidak valid.' }),
    role: z.enum(['guru', 'pegawai', 'kepala_sekolah', 'admin']),
    gender: z.enum(['Laki-laki', 'Perempuan'], { required_error: 'Jenis kelamin wajib dipilih' }),
    nip: z.string().optional(),
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
            const matchRole = userFilter === 'all' ? u.role !== 'admin' : u.role === userFilter;
            const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase());
            return matchRole && matchSearch;
        }).sort((a, b) => (a.sequenceNumber ?? 999) - (b.sequenceNumber ?? 999));
    }, [usersData, userFilter, userSearch]);

    const userForm = useForm<z.infer<typeof addUserSchema>>({
        resolver: zodResolver(addUserSchema),
        defaultValues: { role: 'guru', gender: 'Laki-laki', name: '', email: '', nip: '', position: '', sequenceNumber: '', password: '' },
    });

    useEffect(() => {
        if (editingUser) {
            userForm.reset({
                name: editingUser.name || '',
                email: editingUser.email || '',
                role: editingUser.role || 'guru',
                gender: editingUser.gender || 'Laki-laki',
                nip: editingUser.nip || '',
                position: editingUser.position || '',
                sequenceNumber: editingUser.sequenceNumber?.toString() || '',
                password: '',
            });
        } else {
            userForm.reset({ role: 'guru', gender: 'Laki-laki', name: '', email: '', nip: '', position: '', sequenceNumber: '', password: '' });
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
                await updateDocumentNonBlocking(userRef, {
                    name: values.name,
                    role: values.role,
                    gender: values.gender,
                    nip: values.nip || null,
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
                    await setDocumentNonBlocking(doc(firestore, "users", cred.user.uid), {
                        id: cred.user.uid, name: values.name, role: values.role, gender: values.gender,
                        email: values.email, status: 'Aktif', nip: values.nip || null, position: values.position || null,
                        sequenceNumber: finalSeq,
                    }, {});
                    toast({ title: 'Berhasil', description: 'Akun baru telah dibuat.' });
                    setIsUserDialogOpen(false);
                } finally { await deleteApp(tempApp); }
            }
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Kesalahan', description: e.message }); 
        } finally { setIsSaving(false); }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete || !firestore) return;
        setIsSaving(true);
        try {
            const userRef = doc(firestore, "users", userToDelete.id);
            await deleteDocumentNonBlocking(userRef);
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
            } else throw new Error(result.error);
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

                <Button size="lg" className="w-full font-bold rounded-xl h-12 shadow-lg shadow-primary/20 bg-primary" onClick={() => { setEditingUser(null); setIsUserDialogOpen(true); }}><PlusCircle className="mr-2 h-5 w-5" />Tambah personil</Button>

                <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl bg-card">
                    <CardHeader className="p-6 border-b border-muted-foreground/5"><CardTitle className="font-bold text-blue-600 text-sm">Daftar pengguna sistem</CardTitle></CardHeader>
                    <CardContent className="py-6">
                        <div className="flex flex-col gap-4 sm:flex-row mb-8">
                            <Select value={userFilter} onValueChange={setUserFilter}><SelectTrigger className="w-full sm:w-[240px] h-11 rounded-xl bg-muted/30 font-bold text-xs"><Filter className="h-4 w-4 text-primary mr-2" /><SelectValue /></SelectTrigger><SelectContent className='border-none'><SelectItem value="all">Semua staf</SelectItem><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem></SelectContent></Select>
                            <div className="relative w-full sm:w-[320px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" /><Input placeholder="Cari nama..." className="pl-10 h-11 rounded-xl bg-muted/30 font-bold text-xs" value={userSearch} onChange={e => setUserSearch(e.target.value)} /></div>
                        </div>

                        <div className="border rounded-xl overflow-hidden border-muted-foreground/5">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px]">No</TableHead>
                                        <TableHead className="font-bold text-[10px]">Nama & email</TableHead>
                                        <TableHead className="font-bold text-[10px]">Peran</TableHead>
                                        <TableHead className="font-bold text-[10px]">Jenis kelamin</TableHead>
                                        <TableHead className="font-bold text-[10px]">Identitas</TableHead>
                                        <TableHead className="text-center font-bold text-[10px]">Status</TableHead>
                                        <TableHead className="text-right font-bold text-[10px] pr-6">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                                        <TableRow key={u.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                            <TableCell className="text-center font-bold text-muted-foreground text-sm">{u.sequenceNumber ?? i + 1}</TableCell>
                                            <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{u.name}</span><span className="text-[10px] text-muted-foreground font-bold">{u.email}</span></div></TableCell>
                                            <TableCell><Badge variant="secondary" className="text-[9px] font-bold px-3">{u.role.replace('_', ' ')}</Badge></TableCell>
                                            <TableCell><span className="text-xs font-medium">{u.gender || '-'}</span></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="text-[10px] font-bold">{u.nip || '-'}</span><span className="text-[9px] font-bold text-primary uppercase">{u.position || '-'}</span></div></TableCell>
                                            <TableCell className="text-center"><Badge variant={u.status === 'Aktif' ? 'default' : 'destructive'} className="text-[9px] font-bold">{u.status}</Badge></TableCell>
                                            <TableCell className="text-right pr-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52 rounded-xl p-2 border-none"><DropdownMenuLabel className="text-[10px] uppercase">Aksi</DropdownMenuLabel><DropdownMenuItem onClick={() => { setEditingUser(u); setIsUserDialogOpen(true); }}><Edit2 className="mr-3 h-4 w-4" />Ubah data</DropdownMenuItem><DropdownMenuItem onClick={() => { setUserForReset(u); setIsResetPassDialogOpen(true); }}><KeyRound className="mr-3 h-4 w-4" />Reset sandi</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => { setUserToDelete(u); setIsDeleteDialogOpen(true); }}><Trash2 className="mr-3 h-4 w-4" />Hapus akun</DropdownMenuItem></DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-bold text-xs opacity-40">Data tidak ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if (!open) setEditingUser(null); }}>
                <DialogContent className="rounded-xl border-none max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 pb-2 border-b border-muted-foreground/5"><DialogTitle className="text-xl font-bold">{editingUser ? 'Perbarui data' : 'Tambah personil'}</DialogTitle></div>
                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <Form {...userForm}>
                            <form onSubmit={userForm.handleSubmit(handleSaveUser)} className="space-y-4 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="name" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Nama</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={userForm.control} name="email" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Email</FormLabel><FormControl><Input type="email" {...field} disabled={!!editingUser} className="h-11 rounded-xl bg-muted/30" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="role" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Peran</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger></FormControl><SelectContent className='border-none'><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={userForm.control} name="gender" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Kelamin</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger></FormControl><SelectContent className='border-none'><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="nip" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">NIP</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={userForm.control} name="position" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Status</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <FormField control={userForm.control} name="sequenceNumber" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">No. urut laporan</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl bg-muted/30" /></FormControl><FormMessage /></FormItem>)} />
                                {!editingUser && <FormField control={userForm.control} name="password" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Sandi</FormLabel><FormControl><Input type="password" {...field} className="h-11 rounded-xl bg-muted/30" /></FormControl><FormMessage /></FormItem>)} />}
                                <Button type="submit" className="w-full h-12 rounded-xl font-bold bg-primary" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Simpan'}</Button>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setUserToDelete(null); }}>
                <AlertDialogContent className="rounded-xl border-none"><AlertDialogHeader><AlertDialogTitle className="font-bold">Hapus pengguna?</AlertDialogTitle><AlertDialogDescription>Data <strong>{userToDelete?.name}</strong> akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl font-bold">Batal</AlertDialogCancel><AlertDialogAction className="rounded-xl font-bold bg-destructive" onClick={handleDeleteUser}>Ya, hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <Dialog open={isResetPassDialogOpen} onOpenChange={setIsResetPassDialogOpen}>
                <DialogContent className="rounded-xl border-none max-w-sm">
                    <div className="space-y-4 p-4">
                        <DialogTitle className="font-bold text-xl">Reset kata sandi</DialogTitle>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Sandi baru untuk {userForReset?.name}</Label>
                            <Input type="password" value={newPassInput} onChange={e => setNewPassInput(e.target.value)} placeholder="Minimal 6 karakter" className="h-11 rounded-xl bg-muted/30" />
                        </div>
                        <Button className="w-full h-11 rounded-xl font-bold" onClick={handleManualResetPassword} disabled={isSaving || newPassInput.length < 6}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Update Sandi'}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
