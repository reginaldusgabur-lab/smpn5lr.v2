'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  UserX,
  UserCheck,
  PlaneTakeoff,
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
import { useUser, useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, collection, getDocs } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { resetUserPassword, updateUserEmail } from '@/app/actions/admin-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

const addUserSchema = z.object({
    name: z.string().min(1, { message: 'Nama wajib diisi' }),
    email: z.string().email({ message: 'Email tidak valid.' }),
    role: z.enum(['guru', 'pegawai', 'kepala_sekolah', 'admin']),
    gender: z.enum(['Laki-laki', 'Perempuan'], { required_error: 'Jenis kelamin wajib dipilih' }),
    status: z.enum(['Aktif', 'Nonaktif', 'Cuti']).default('Aktif'),
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
    const [isCutiDialogOpen, setIsCutiDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [usersData, setUsersData] = useState<any[] | null>(null);
    const [isUsersLoading, setIsUsersLoading] = useState(true);
    
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const [userForReset, setUserForReset] = useState<any | null>(null);
    const [userForCuti, setUserForCuti] = useState<any | null>(null);
    const [newPassInput, setNewPassInput] = useState('');

    const loadUsers = useCallback(async (forceRefresh = false) => {
        if (!firestore) return;
        setIsUsersLoading(true);
        const CACHE_KEY = 'espenli_daftar_guru_v2';
        if (!forceRefresh) {
            const cached = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
            if (cached) {
                try {
                    setUsersData(JSON.parse(cached));
                    setIsUsersLoading(false);
                    return;
                } catch (e) { localStorage.removeItem(CACHE_KEY); }
            }
        }
        try {
            const snap = await getDocs(collection(firestore, 'users'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsersData(data);
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (error) { toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memuat data.' }); }
        finally { setIsUsersLoading(false); }
    }, [firestore, toast]);

    useEffect(() => { if (!isAuthLoading && user) loadUsers(); }, [isAuthLoading, user, loadUsers]);

    const filteredUsers = useMemo(() => {
        if (!usersData) return [];
        return usersData.filter(u => {
            const matchRole = userFilter === 'all' ? true : u.role === userFilter;
            const matchSearch = (u.name || '').toLowerCase().includes(userSearch.toLowerCase());
            return matchRole && matchSearch;
        }).sort((a, b) => (a.sequenceNumber ?? 999) - (b.sequenceNumber ?? 999));
    }, [usersData, userFilter, userSearch]);

    const existingKepsek = useMemo(() => {
        return (usersData || []).find(u => u.role === 'kepala_sekolah');
    }, [usersData]);

    const userStats = useMemo(() => {
        return (usersData || []).reduce((acc, curr) => {
            if (curr.role === 'admin') return acc;
            acc.total++;
            if (curr.gender === 'Laki-laki') acc.lakiLaki++;
            else if (curr.gender === 'Perempuan') acc.perempuan++;
            if (curr.position === 'PNS') acc.pns++;
            else if (curr.position === 'PPPK') acc.pppk++;
            if (curr.role === 'pegawai') acc.pegawai++;
            return acc;
        }, { total: 0, lakiLaki: 0, perempuan: 0, pns: 0, pppk: 0, pegawai: 0 });
    }, [usersData]);

    const userForm = useForm<z.infer<typeof addUserSchema>>({
        resolver: zodResolver(addUserSchema),
        defaultValues: { role: 'guru', gender: 'Laki-laki', status: 'Aktif', name: '', email: '', nip: '', position: '', sequenceNumber: '', password: '' },
    });

    useEffect(() => {
        if (editingUser) {
            userForm.reset({
                name: editingUser.name || '', email: editingUser.email || '',
                role: editingUser.role || 'guru', gender: editingUser.gender || 'Laki-laki',
                status: editingUser.status || 'Aktif', nip: editingUser.nip || '',
                position: editingUser.position || '',
                sequenceNumber: editingUser.sequenceNumber?.toString() || '', password: '',
            });
        }
    }, [editingUser, userForm]);

    const handleSaveUser = async (values: z.infer<typeof addUserSchema>) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const parsedSeq = values.sequenceNumber ? parseInt(values.sequenceNumber, 10) : null;
            const finalSeq = (parsedSeq !== null && !isNaN(parsedSeq)) ? parsedSeq : null;
            if (editingUser) {
                // Perbarui email di Auth jika berubah
                if (values.email !== editingUser.email) {
                    const res = await updateUserEmail(editingUser.id, values.email);
                    if (!res.success) throw new Error(res.error);
                }

                updateDocumentNonBlocking(doc(firestore, "users", editingUser.id), {
                    name: values.name, email: values.email, role: values.role, gender: values.gender,
                    status: values.status, nip: values.nip || null,
                    position: values.position || null,
                    sequenceNumber: finalSeq,
                });
                toast({ title: 'Berhasil', description: 'Data diperbarui.' });
                setIsUserDialogOpen(false); loadUsers(true);
            } else {
                if (!values.password) throw new Error("Password wajib diisi.");
                const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
                try {
                    const cred = await createUserWithEmailAndPassword(getAuth(tempApp), values.email, values.password);
                    setDocumentNonBlocking(doc(firestore, "users", cred.user.uid), {
                        id: cred.user.uid, name: values.name, role: values.role, 
                        gender: values.gender, email: values.email, status: values.status, 
                        nip: values.nip || null,
                        position: values.position || null, sequenceNumber: finalSeq,
                    }, {});
                    toast({ title: 'Berhasil', description: 'Akun dibuat.' });
                    setIsUserDialogOpen(false); loadUsers(true);
                } finally { await deleteApp(tempApp); }
            }
        } catch (e: any) { toast({ variant: 'destructive', title: 'Gagal', description: e.message }); }
        finally { setIsSaving(false); }
    };

    const handleToggleUserStatus = (u: any, s?: string) => {
        if (!firestore) return;
        const nS = s || (u.status === 'Aktif' ? 'Nonaktif' : 'Aktif');
        updateDocumentNonBlocking(doc(firestore, "users", u.id), { status: nS });
        toast({ title: 'Status Diperbarui', description: `${u.name} kini ${nS}.` });
        loadUsers(true);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete || !firestore) return;
        setIsSaving(true);
        try {
            deleteDocumentNonBlocking(doc(firestore, "users", userToDelete.id));
            toast({ title: 'Berhasil', description: 'Pengguna dihapus.' });
            setIsDeleteDialogOpen(false); loadUsers(true);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Gagal', description: e.message }); }
        finally { setIsSaving(false); }
    };

    const handleManualResetPassword = async () => {
        if (!userForReset || newPassInput.length < 6) return;
        setIsSaving(true);
        try {
            const result = await resetUserPassword(userForReset.id, newPassInput);
            if (result.success) {
                toast({ title: 'Berhasil', description: 'Kata sandi diperbarui.' });
                setIsResetPassDialogOpen(false); setNewPassInput('');
            } else { throw new Error(result.error); }
        } catch (e: any) { toast({ variant: 'destructive', title: 'Gagal', description: e.message }); }
        finally { setIsSaving(false); }
    };

    const handleConfirmCutiStatus = () => {
        if (!userForCuti || !firestore) return;
        handleToggleUserStatus(userForCuti, 'Cuti');
        setIsCutiDialogOpen(false);
    };

    if (isAuthLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4">
                <Card className="overflow-hidden border border-muted-foreground/10 shadow-none rounded-xl p-0">
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white flex items-center justify-between">
                        <div className="flex items-center gap-4"><div className="bg-white/20 p-3 rounded-2xl shadow-sm"><UsersIcon className="h-6 w-6" /></div><div className="space-y-0.5"><h1 className="font-bold text-2xl tracking-tight">Manajemen pengguna</h1><p className="text-[11px] font-medium text-white/80">Kelola data personil sekolah.</p></div></div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => loadUsers(true)} disabled={isUsersLoading}><RefreshCw className={cn("h-4 w-4", isUsersLoading && "animate-spin")} /></Button>
                    </div>
                </Card>

                <Button size="lg" className="w-full font-bold rounded-xl h-12 shadow-lg shadow-primary/20 bg-primary uppercase tracking-widest text-[11px]" onClick={() => { setEditingUser(null); setIsUserDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" />Tambah personil</Button>

                <Card className="w-full border-muted-foreground/10 shadow-none rounded-xl bg-card">
                    <CardHeader className="p-6 border-b border-muted-foreground/5"><CardTitle className="font-bold text-blue-600 text-[10px] uppercase tracking-[0.2em]">Daftar personil sekolah</CardTitle></CardHeader>
                    <CardContent className="py-6">
                        <div className="flex flex-col gap-4 sm:flex-row mb-8">
                            <Select value={userFilter} onValueChange={setUserFilter}><SelectTrigger className="w-full sm:w-[240px] h-11 rounded-xl bg-muted/30 font-bold text-xs shadow-none"><Filter className="h-4 w-4 text-primary mr-2" /><SelectValue /></SelectTrigger><SelectContent className='border-none shadow-2xl'><SelectItem value="all">Semua personil</SelectItem><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem><SelectItem value="admin">Admin Utama</SelectItem></SelectContent></Select>
                            <div className="relative w-full sm:w-[320px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" /><Input placeholder="Cari nama..." className="pl-10 h-11 rounded-xl bg-muted/30 font-bold text-xs shadow-none" value={userSearch} onChange={e => setUserSearch(e.target.value)} /></div>
                        </div>

                        <div className="border rounded-xl overflow-hidden border-muted-foreground/5 mb-8">
                            <Table>
                                <TableHeader className="bg-muted/30"><TableRow className="border-none"><TableHead className="w-[60px] text-center font-bold text-[10px] uppercase">No</TableHead><TableHead className="font-bold text-[10px] uppercase">Nama & email</TableHead><TableHead className="font-bold text-[10px] uppercase">Peran</TableHead><TableHead className="font-bold text-[10px] uppercase">Gender</TableHead><TableHead className="font-bold text-[10px] uppercase">NIP</TableHead><TableHead className="text-center font-bold text-[10px] uppercase">Status</TableHead><TableHead className="text-right font-bold text-[10px] uppercase pr-6">Aksi</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {isUsersLoading ? [...Array(5)].map((_, i) => (
                                        <TableRow key={i} className="border-muted-foreground/5">
                                            <TableCell colSpan={7} className="h-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary/30" /></TableCell>
                                        </TableRow>
                                    )) : filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                                        <TableRow key={u.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                                            <TableCell className="text-center font-bold text-muted-foreground text-sm">{u.sequenceNumber ?? i + 1}</TableCell>
                                            <TableCell><div className="flex items-center gap-3"><Avatar className="h-9 w-9 border border-muted-foreground/10"><AvatarImage src={u.photoURL} alt={u.name} className="object-cover" /><AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">{getInitials(u.name || '')}</AvatarFallback></Avatar><div className="flex flex-col"><span className="font-bold text-sm">{u.name}</span><span className="text-[10px] text-muted-foreground font-bold">{u.email}</span></div></div></TableCell>
                                            <TableCell><Badge variant="secondary" className="text-[9px] font-bold px-3">{u.role.replace('_', ' ')}</Badge></TableCell>
                                            <TableCell><span className="text-xs font-medium">{u.gender || '-'}</span></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="text-[10px] font-bold">{u.nip || '-'}</span><span className="text-[9px] font-bold text-primary uppercase">{u.position || '-'}</span></div></TableCell>
                                            <TableCell className="text-center"><Badge variant={u.status === 'Nonaktif' ? 'destructive' : (u.status === 'Cuti' ? 'outline' : 'default')} className={cn("text-[9px] font-bold px-3 py-1 rounded-full", u.status === 'Cuti' ? "bg-amber-500 text-white border-none" : "")}>{u.status || 'Aktif'}</Badge></TableCell>
                                            <TableCell className="text-right pr-4"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52 rounded-xl p-2 border-none shadow-2xl"><DropdownMenuLabel className="text-[10px] uppercase">Aksi</DropdownMenuLabel><DropdownMenuItem className="rounded-lg" onClick={() => { setEditingUser(u); setIsUserDialogOpen(true); }}><Edit2 className="mr-3 h-4 w-4" />Ubah data</DropdownMenuItem><DropdownMenuItem className="rounded-lg" onClick={() => { setUserForCuti(u); setIsCutiDialogOpen(true); }}><PlaneTakeoff className="mr-3 h-4 w-4" />Jadikan Cuti</DropdownMenuItem>{u.status === 'Cuti' && <DropdownMenuItem className="text-blue-600 rounded-lg" onClick={() => handleToggleUserStatus(u, 'Aktif')}><UserCheck className="mr-3 h-4 w-4" />Kembalikan Aktif</DropdownMenuItem>}<DropdownMenuItem className={u.status === 'Nonaktif' ? "text-emerald-600 rounded-lg" : "text-amber-600 rounded-lg"} onClick={() => handleToggleUserStatus(u)}>{u.status === 'Nonaktif' ? <><UserCheck className="mr-3 h-4 w-4" />Aktifkan akun</> : <><UserX className="mr-3 h-4 w-4" />Nonaktifkan akun</>}</DropdownMenuItem><DropdownMenuItem className="rounded-lg" onClick={() => { setUserForReset(u); setIsResetPassDialogOpen(true); }}><KeyRound className="mr-3 h-4 w-4" />Reset sandi</DropdownMenuItem><DropdownMenuSeparator className="opacity-50" /><DropdownMenuItem className="text-destructive rounded-lg" onClick={() => { setUserToDelete(u); setIsDeleteDialogOpen(true); }}><Trash2 className="mr-3 h-4 w-4" />Hapus akun</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-bold text-xs tracking-widest opacity-40">Data tidak ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="pt-8 border-t border-muted-foreground/10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4 ml-1">Ringkasan Personil (Kecuali Admin)</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-primary/5 p-4 rounded-2xl text-center border border-primary/5">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-2">Total</p>
                                    <p className="text-xl font-black text-primary leading-none">{userStats.total}</p>
                                </div>
                                <div className="bg-blue-500/5 p-4 rounded-2xl text-center border border-blue-500/10">
                                    <p className="text-[8px] font-black uppercase text-blue-600/60 tracking-widest leading-none mb-2">Laki-laki</p>
                                    <p className="text-xl font-black text-blue-600 leading-none">{userStats.lakiLaki}</p>
                                </div>
                                <div className="bg-pink-500/5 p-4 rounded-2xl text-center border border-pink-500/10">
                                    <p className="text-[8px] font-black uppercase text-pink-600/60 tracking-widest leading-none mb-2">Perempuan</p>
                                    <p className="text-xl font-black text-pink-600 leading-none">{userStats.perempuan}</p>
                                </div>
                                <div className="bg-emerald-500/5 p-4 rounded-2xl text-center border border-emerald-500/10">
                                    <p className="text-[8px] font-black uppercase text-emerald-600/60 tracking-widest leading-none mb-2">Pegawai</p>
                                    <p className="text-xl font-black text-emerald-600 leading-none">{userStats.pegawai}</p>
                                </div>
                                <div className="bg-amber-500/5 p-4 rounded-2xl text-center border border-amber-500/10">
                                    <p className="text-[8px] font-black uppercase text-amber-600/60 tracking-widest leading-none mb-2">PNS</p>
                                    <p className="text-xl font-black text-amber-600 leading-none">{userStats.pns}</p>
                                </div>
                                <div className="bg-purple-500/5 p-4 rounded-2xl text-center border border-purple-500/10">
                                    <p className="text-[8px] font-black uppercase text-purple-600/60 tracking-widest leading-none mb-2">PPPK</p>
                                    <p className="text-xl font-black text-purple-600 leading-none">{userStats.pppk}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isCutiDialogOpen} onOpenChange={setIsCutiDialogOpen}>
                <DialogContent className="rounded-2xl border-none shadow-2xl p-0 overflow-hidden max-w-sm">
                    <DialogHeader className="p-6 bg-primary text-white"><DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight"><PlaneTakeoff className="h-6 w-6" /> Aktifkan Mode Cuti</DialogTitle></DialogHeader>
                    <div className="p-6 space-y-4">
                        <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                            Mengubah status <strong>{userForCuti?.name}</strong> menjadi <span className="text-primary italic">Cuti</span> akan memungkinkan pengguna tersebut untuk mengajukan rentang tanggal cuti secara mandiri melalui menu Izin.
                        </p>
                        <div className="pt-2"><Button className="w-full h-11 rounded-xl font-black bg-primary uppercase tracking-widest shadow-lg text-[10px]" onClick={handleConfirmCutiStatus}>YA, JADIKAN CUTI</Button></div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if (!open) setEditingUser(null); }}>
                <DialogContent className="rounded-xl border-none max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="text-xl font-bold mb-4">{editingUser ? 'Ubah data personil' : 'Tambah personil baru'}</DialogTitle>
                    <Form {...userForm}>
                        <form onSubmit={userForm.handleSubmit(handleSaveUser)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={userForm.control} name="name" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Nama</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={userForm.control} name="email" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Email</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={userForm.control} name="role" render={({field}) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-bold uppercase">Peran</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className='rounded-xl'>
                                                <SelectItem value="guru" className="rounded-lg">Guru</SelectItem>
                                                <SelectItem value="pegawai" className="rounded-lg">Pegawai</SelectItem>
                                                <SelectItem value="kepala_sekolah" disabled={!!existingKepsek && editingUser?.id !== existingKepsek.id} className="rounded-lg">
                                                    Kepala Sekolah {!!existingKepsek && editingUser?.id !== existingKepsek.id && "(Terisi)"}
                                                </SelectItem>
                                                <SelectItem value="admin" className="rounded-lg">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={userForm.control} name="gender" render={({field}) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-bold uppercase">Gender</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className='rounded-xl'>
                                                <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                                                <SelectItem value="Perempuan">Perempuan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={userForm.control} name="nip" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">NIP</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl></FormItem>)} />
                                <FormField control={userForm.control} name="position" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Status Kepegawaian</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={userForm.control} name="sequenceNumber" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">No. Urut Laporan</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl></FormItem>)} />
                                <FormField control={userForm.control} name="status" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Status Akun</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger></FormControl><SelectContent className='rounded-xl'><SelectItem value="Aktif">Aktif</SelectItem><SelectItem value="Cuti" className="text-amber-600">Cuti</SelectItem><SelectItem value="Nonaktif" className="text-red-600">Nonaktif</SelectItem></SelectContent></Select></FormItem>)} />
                            </div>
                            {!editingUser && <FormField control={userForm.control} name="password" render={({field}) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Sandi Awal</FormLabel><FormControl><Input type="password" {...field} className="h-11 rounded-xl bg-muted/30 shadow-none" /></FormControl></FormItem>)} />}
                            <Button type="submit" className="w-full h-12 rounded-xl font-bold bg-primary uppercase text-[11px]" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Simpan Data'}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setUserToDelete(null); }}><AlertDialogContent className="rounded-xl border-none shadow-2xl"><AlertDialogHeader><AlertDialogTitle className="font-bold text-lg">Hapus pengguna?</AlertDialogTitle><AlertDialogDescription className="font-medium text-sm">Data <strong>{userToDelete?.name}</strong> akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold shadow-none">Batal</AlertDialogCancel><AlertDialogAction className="rounded-xl font-bold bg-destructive uppercase text-[10px]" onClick={handleDeleteUser}>Ya, hapus permanen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

            <Dialog open={isResetPassDialogOpen} onOpenChange={setIsResetPassDialogOpen}><DialogContent className="rounded-xl border-none max-sm shadow-2xl"><div className="space-y-4 p-4"><DialogTitle className="font-bold text-xl uppercase text-primary">Reset kata sandi</DialogTitle><div className="space-y-2"><Label className="text-[10px] font-bold uppercase ml-1">Sandi baru untuk {userForReset?.name}</Label><Input type="password" value={newPassInput} onChange={e => setNewPassInput(e.target.value)} placeholder="Minimal 6 karakter" className="h-11 rounded-xl bg-muted/30" /></div><Button className="w-full h-11 rounded-xl font-bold uppercase text-[10px]" onClick={handleManualResetPassword} disabled={isSaving || newPassInput.length < 6}>Perbarui Sandi</Button></div></DialogContent></Dialog>
        </div>
    );
}
