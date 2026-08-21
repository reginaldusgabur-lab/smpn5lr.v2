
'use client';
import React, { useState, useMemo, useEffect } from 'react';

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
  Power,
  AlertCircle,
  KeyRound,
  Users as UsersIcon,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { resetUserPassword } from '@/app/actions/admin-actions';
import { cn } from '@/lib/utils';

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

    // Kalkulasi statistik gender berdasarkan user yang difilter
    const genderStats = useMemo(() => {
        return filteredUsers.reduce((acc, u) => {
            if (u.gender === 'Laki-laki') acc.male++;
            else if (u.gender === 'Perempuan') acc.female++;
            return acc;
        }, { male: 0, female: 0 });
    }, [filteredUsers]);

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

    async function handleSaveUser(values: z.infer<typeof addUserSchema>) {
        if (!firestore) return;
        setIsSaving(true);

        try {
            if (editingUser) {
                const userRef = doc(firestore, "users", editingUser.id);
                const updatedData = {
                    name: values.name,
                    role: values.role,
                    gender: values.gender,
                    nip: values.nip || null,
                    position: values.position || null,
                    sequenceNumber: values.sequenceNumber ? parseInt(values.sequenceNumber, 10) : null,
                };
                await updateDocumentNonBlocking(userRef, updatedData);
                toast({ title: 'Berhasil', description: 'Data pengguna telah diperbarui.' });
                setIsUserDialogOpen(false);
                setEditingUser(null);
            } else {
                if (!values.password) {
                    toast({ variant: 'destructive', title: 'Gagal', description: 'Password wajib diisi untuk pengguna baru.' });
                    setIsSaving(false);
                    return;
                }
                const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
                try {
                    const cred = await createUserWithEmailAndPassword(getAuth(tempApp), values.email, values.password);
                    const userDoc = {
                        id: cred.user.uid, 
                        name: values.name, 
                        role: values.role, 
                        gender: values.gender,
                        email: values.email, 
                        status: 'Aktif',
                        nip: values.nip || null, position: values.position || null,
                        sequenceNumber: values.sequenceNumber ? parseInt(values.sequenceNumber, 10) : null,
                    };
                    await setDocumentNonBlocking(doc(firestore, "users", cred.user.uid), userDoc, {});
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
    }

    const handleToggleStatus = async (targetUser: any) => {
        if (!firestore) return;
        const newStatus = targetUser.status === 'Aktif' ? 'Non-Aktif' : 'Aktif';
        try {
            const userRef = doc(firestore, "users", targetUser.id);
            await updateDocumentNonBlocking(userRef, { status: newStatus });
            toast({ title: 'Status diperbarui', description: `${targetUser.name} sekarang ${newStatus}.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengubah status.' });
        }
    };

    const handleDeleteUser = async () => {
        if (!firestore || !userToDelete) return;
        setIsSaving(true);
        try {
            const userRef = doc(firestore, "users", userToDelete.id);
            await deleteDocumentNonBlocking(userRef);
            toast({ title: 'Berhasil', description: 'Data pengguna telah dihapus.' });
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Kesalahan', description: 'Gagal menghapus data.' });
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
                toast({ title: 'Berhasil', description: `Kata sandi untuk ${userForReset.name} telah diperbarui.` });
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

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <Card className="overflow-hidden bg-card border border-muted-foreground/10 shadow-none rounded-2xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 rotate-12">
                            <UsersIcon className="w-24 h-24 text-white" />
                        </div>
                        
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white shrink-0 border border-white/10 shadow-sm backdrop-blur-sm">
                                    <UsersIcon className="h-6 w-6" />
                                </div>
                                <div className="space-y-0.5">
                                    <h1 className="font-bold text-2xl tracking-tight leading-tight">Manajemen pengguna</h1>
                                    <p className="text-[11px] font-medium text-white/80 leading-relaxed">Kelola data personil sekolah dengan mudah.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10 shadow-none" onClick={() => router.refresh()}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-center px-4 md:px-0">
                    <Button size="lg" className="w-full font-bold rounded-xl h-12 shadow-lg shadow-primary/20 active:scale-95 transition-all bg-primary hover:bg-primary/90 uppercase text-[11px] tracking-widest" onClick={() => { setEditingUser(null); setIsUserDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Tambah personil
                    </Button>
                </div>

                <Card className="w-full border border-muted-foreground/10 shadow-none rounded-xl overflow-hidden bg-card">
                    <CardHeader className="p-6 border-b border-muted-foreground/5">
                        <CardTitle className="font-bold text-blue-600 dark:text-blue-400 text-sm tracking-tight">Daftar pengguna sistem</CardTitle>
                        <CardDescription className="text-muted-foreground font-medium text-xs">Informasi akun dan hak akses pengguna aktif.</CardDescription>
                    </CardHeader>
                    <CardContent className="py-6 min-h-[400px]">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 px-2 sm:px-0">
                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger className="w-full sm:w-[240px] h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold text-xs">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-primary" />
                                        <SelectValue placeholder="Saring peran" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none">
                                    <SelectItem value="all" className='rounded-lg font-bold'>Semua staf</SelectItem>
                                    <SelectItem value="guru" className='rounded-lg font-bold'>Guru</SelectItem>
                                    <SelectItem value="pegawai" className='rounded-lg font-bold'>Pegawai</SelectItem>
                                    <SelectItem value="kepala_sekolah" className='rounded-lg font-bold'>Kepala Sekolah</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative w-full sm:w-[320px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                <Input 
                                    placeholder="Cari nama personil..." 
                                    className="pl-10 h-11 rounded-xl bg-muted/30 border-muted-foreground/10 font-bold text-xs shadow-none" 
                                    value={userSearch} 
                                    onChange={e => setUserSearch(e.target.value)} 
                                />
                            </div>
                        </div>

                        <div className="border rounded-xl overflow-hidden border-muted-foreground/5">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none">
                                        <TableHead className="w-[60px] text-center font-bold text-[10px] text-muted-foreground border-none h-11">No</TableHead>
                                        <TableHead className="font-bold text-[10px] text-muted-foreground border-none h-11">Nama & email</TableHead>
                                        <TableHead className="font-bold text-[10px] text-muted-foreground border-none h-11">Peran</TableHead>
                                        <TableHead className="font-bold text-[10px] text-muted-foreground border-none h-11">Jenis kelamin</TableHead>
                                        <TableHead className="font-bold text-[10px] text-muted-foreground border-none h-11">Identitas</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] text-muted-foreground border-none h-11">Status</TableHead>
                                        <TableHead className="text-right font-bold text-[10px] text-muted-foreground border-none h-11 pr-6">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(isUsersLoading || isAuthLoading) ? (
                                        [...Array(6)].map((_, i) => (
                                            <TableRow key={i} className="border-muted-foreground/5">
                                                <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-10 w-48 rounded-lg" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24 rounded-md" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32 rounded-md" /></TableCell>
                                                <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                                                <TableCell><Skeleton className="h-8 w-8 ml-auto rounded-full mr-2" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                                        <TableRow key={u.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                            <TableCell className="text-center font-bold text-muted-foreground/60 text-sm">{u.sequenceNumber ?? i + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-foreground">{u.name}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">{u.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[9px] font-bold capitalize py-0.5 px-3">
                                                    {u.role.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs font-medium text-foreground">{u.gender || '-'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-foreground">{u.nip || '-'}</span>
                                                    <span className="text-[9px] font-bold text-primary uppercase tracking-tight">{u.position || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={u.status === 'Aktif' ? 'default' : 'destructive'} className="text-[9px] font-bold px-3 py-0.5">
                                                    {u.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10 shadow-none">
                                                            <MoreHorizontal className="h-5 w-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52 rounded-xl p-2 shadow-2xl border-none">
                                                        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-1">Aksi pengguna</DropdownMenuLabel>
                                                        <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-primary/5" onClick={() => { setEditingUser(u); setIsUserDialogOpen(true); }}>
                                                            <Edit2 className="mr-3 h-4 w-4 text-primary" />
                                                            <span className="text-xs font-bold">Ubah data</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-primary/5" onClick={() => { setUserForReset(u); setIsResetPassDialogOpen(true); }}>
                                                            <KeyRound className="mr-3 h-4 w-4 text-primary" />
                                                            <span className="text-xs font-bold">Reset kata sandi</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-primary/5" onClick={() => handleToggleStatus(u)}>
                                                            <Power className={`mr-3 h-4 w-4 ${u.status === 'Aktif' ? 'text-orange-500' : 'text-green-500'}`} />
                                                            <span className="text-xs font-bold">{u.status === 'Aktif' ? 'Non-aktifkan' : 'Aktifkan'} akun</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="my-1.5 opacity-50" />
                                                        <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3 text-destructive focus:bg-destructive/5" onClick={() => { setUserToDelete(u); setIsDeleteDialogOpen(true); }}>
                                                            <Trash2 className="mr-3 h-4 w-4" />
                                                            <span className="text-xs font-bold">Hapus akun</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-bold text-xs tracking-widest opacity-40">
                                                Data tidak ditemukan
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Statistik Gender */}
                        {!isUsersLoading && filteredUsers.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-muted-foreground/10 flex flex-wrap gap-6 items-center px-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Laki-laki:</span>
                                    <Badge variant="secondary" className="rounded-lg px-3 py-1 font-black text-xs bg-primary/10 text-primary border-none shadow-none">{genderStats.male}</Badge>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Perempuan:</span>
                                    <Badge variant="secondary" className="rounded-lg px-3 py-1 font-black text-xs bg-pink-500/10 text-pink-600 border-none shadow-none">{genderStats.female}</Badge>
                                </div>
                                <div className="flex items-center gap-2.5 ml-auto">
                                    <UsersIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total:</span>
                                    <Badge variant="outline" className="rounded-lg px-3 py-1 font-black text-xs border-muted-foreground/20 text-foreground/80 shadow-none">{filteredUsers.length}</Badge>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dialog Reset Password */}
            <Dialog open={isResetPassDialogOpen} onOpenChange={setIsResetPassDialogOpen}>
                <DialogContent className="rounded-xl border-none max-w-sm shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary">Reset kata sandi</DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            Setel kata sandi baru untuk <strong>{userForReset?.name}</strong>. Berikan info ini kepada pengguna setelah berhasil.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-pass" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Kata sandi baru</Label>
                            <Input 
                                id="new-pass" 
                                type="text" 
                                placeholder="Minimal 6 karakter" 
                                value={newPassInput} 
                                onChange={e => setNewPassInput(e.target.value)}
                                className="h-12 rounded-xl bg-muted/30 border-muted-foreground/10 font-bold shadow-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            className="w-full h-12 rounded-xl font-bold shadow-none active:scale-95 transition-all" 
                            disabled={isSaving || newPassInput.length < 6}
                            onClick={handleManualResetPassword}
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Simpan kata sandi baru'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Tambah/Edit User */}
            <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if (!open) setEditingUser(null); }}>
                <DialogContent className="rounded-xl border-none max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                    <DialogHeader className="p-6 pb-2 border-b border-muted-foreground/5">
                        <DialogTitle className="text-xl font-bold text-primary">
                            {editingUser ? 'Perbarui data' : 'Tambah personil'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            {editingUser ? `Mengubah informasi data untuk ${editingUser.name}.` : 'Masukkan detail akun untuk personil baru sekolah.'}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                        <Form {...userForm}>
                            <form onSubmit={userForm.handleSubmit(handleSaveUser)} className="space-y-4 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="name" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nama lengkap</FormLabel>
                                            <FormControl><Input placeholder="John Doe, S.Pd" {...field} className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold" /></FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                    <FormField control={userForm.control} name="email" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</FormLabel>
                                            <FormControl><Input type="email" placeholder="nama@email.com" {...field} disabled={!!editingUser} className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold" /></FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="role" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Peran</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold">
                                                        <SelectValue placeholder="Pilih peran" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                                    <SelectItem value="guru" className="rounded-lg font-bold">Guru</SelectItem>
                                                    <SelectItem value="pegawai" className="rounded-lg font-bold">Pegawai</SelectItem>
                                                    <SelectItem value="kepala_sekolah" className="rounded-lg font-bold">Kepala Sekolah</SelectItem>
                                                    <SelectItem value="admin" className="rounded-lg font-bold">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                    <FormField control={userForm.control} name="gender" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Jenis kelamin</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold">
                                                        <SelectValue placeholder="Pilih jenis kelamin" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                                    <SelectItem value="Laki-laki" className="rounded-lg font-bold">Laki-laki</SelectItem>
                                                    <SelectItem value="Perempuan" className="rounded-lg font-bold">Perempuan</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="nip" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nip (opsional)</FormLabel>
                                            <FormControl><Input placeholder="19XXXXXXXXXXXX" {...field} className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold" /></FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                    <FormField control={userForm.control} name="position" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Status kepegawaian</FormLabel>
                                            <FormControl><Input placeholder="PNS / Honorer" {...field} className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold" /></FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={userForm.control} name="sequenceNumber" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">No. urut laporan</FormLabel>
                                            <FormControl><Input type="number" placeholder="1" {...field} className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold" /></FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                </div>

                                {!editingUser && (
                                    <FormField control={userForm.control} name="password" render={({field}) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Kata sandi</FormLabel>
                                            <FormControl><Input type="password" placeholder="Minimal 6 karakter" {...field} className="h-11 rounded-xl bg-muted/30 border-muted-foreground/10 shadow-none font-bold" /></FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )} />
                                )}

                                <div className="pt-4 sticky bottom-0 bg-card/80 backdrop-blur-sm">
                                    <Button type="submit" className="w-full h-12 rounded-xl font-bold shadow-none active:scale-95 transition-all bg-primary" disabled={isSaving}>
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingUser ? 'Perbarui data' : 'Buat akun sekarang')}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Alert Dialog Hapus User */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setUserToDelete(null); }}>
                <AlertDialogContent className="rounded-xl border-none shadow-none">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 text-destructive mb-2">
                            <AlertCircle className="h-6 w-6" />
                            <AlertDialogTitle className="text-xl font-bold">Hapus pengguna?</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-sm font-medium">
                            Tindakan ini akan menghapus data <span className="font-bold text-foreground">{userToDelete?.name}</span> secara permanen dari database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="h-11 rounded-xl font-bold border-muted-foreground/10 active:scale-95 transition-all shadow-none" disabled={isSaving}>Batal</AlertDialogCancel>
                        <AlertDialogAction className="h-11 rounded-xl font-bold bg-destructive hover:bg-destructive/90 shadow-none active:scale-95 transition-all" onClick={handleDeleteUser} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Ya, hapus permanen'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
