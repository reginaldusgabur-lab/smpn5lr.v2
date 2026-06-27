
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
import { Button, buttonVariants } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  User,
  Briefcase,
  Loader2,
  Crown,
  Search,
  ShieldCheck,
  Filter,
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
  DialogTrigger,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type Role = 'guru' | 'pegawai' | 'kepala_sekolah' | 'admin';

type UserData = {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: 'Aktif' | 'Non-Aktif';
    nip?: string | null;
    position?: string | null;
    sequenceNumber?: number | null;
    skNumber?: string | null; 
};

const roleConfig: { [key in Role]: { label: string; placeholder: string; icon: React.ReactNode; title: string; } } = {
  guru: { label: 'NIP', placeholder: 'Masukkan NIP Guru', icon: <User className="h-5 w-5" />, title: 'Guru' },
  pegawai: { label: 'NIP', placeholder: 'NIP Pegawai (Opsional)', icon: <Briefcase className="h-5 w-5" />, title: 'Pegawai' },
  kepala_sekolah: { label: 'NIP', placeholder: 'Masukkan NIP Kepala Sekolah', icon: <Crown className="h-5 w-5" />, title: 'Kepala Sekolah' },
  admin: { label: 'Email', placeholder: 'admin@sekolah.sch.id', icon: <ShieldCheck className="h-5 w-5" />, title: 'Admin' }
};

const addUserSchema = z.object({
    name: z.string().min(1, { message: 'Nama wajib diisi' }),
    email: z.string().email({ message: 'Email tidak valid.' }),
    role: z.enum(['guru', 'pegawai', 'kepala_sekolah', 'admin']),
    identifier: z.string().optional(),
    position: z.string().optional(),
    sequenceNumber: z.string().optional(),
    skNumber: z.string().optional(),
    password: z.string().min(6, { message: 'Password minimal 6 karakter.' }),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, { message: 'Konfirmasi tidak cocok', path: ['confirmPassword'] });

export default function AdminUsersPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [userFilter, setUserFilter] = useState('all');
    const [userSearch, setUserSearch] = useState('');
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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

    const addForm = useForm<z.infer<typeof addUserSchema>>({
        resolver: zodResolver(addUserSchema),
        defaultValues: { role: 'guru', name: '', email: '', identifier: '', position: '', sequenceNumber: '', skNumber: '', password: '', confirmPassword: '' },
    });

    async function handleCreateUser(values: z.infer<typeof addUserSchema>) {
        if (!firestore) return;
        setIsSaving(true);
        const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
        try {
            const cred = await createUserWithEmailAndPassword(getAuth(tempApp), values.email, values.password);
            const userDoc = {
                id: cred.user.uid, name: values.name, role: values.role, email: values.email, status: 'Aktif',
                nip: values.identifier || null, position: values.position || null,
                sequenceNumber: values.sequenceNumber ? parseInt(values.sequenceNumber, 10) : null,
                skNumber: values.skNumber || null
            };
            await setDocumentNonBlocking(doc(firestore, "users", cred.user.uid), userDoc, {});
            toast({ title: 'Berhasil', description: 'Akun telah dibuat.' });
            addForm.reset();
            setIsAddUserDialogOpen(false);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Gagal', description: e.message }); }
        finally { setIsSaving(false); await deleteApp(tempApp); }
    }

    return (
        <div className="flex-1 pt-4 pb-24 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 md:px-0">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h1>
                        <p className="text-muted-foreground mt-1">Kelola data personil sekolah.</p>
                    </div>
                    <Button size="lg" className="font-semibold" onClick={() => setIsAddUserDialogOpen(true)}><PlusCircle className="mr-2 h-5 w-5" />Tambah</Button>
                </div>

                <Card className="w-full">
                    <CardContent className="py-6 min-h-[400px]">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger className="w-full sm:w-[240px] pl-10 relative"><Filter className="absolute left-3 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Peran" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">Semua Staff</SelectItem><SelectItem value="guru">Guru</SelectItem><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem></SelectContent>
                            </Select>
                            <div className="relative w-full sm:w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari nama..." className="pl-10" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="border rounded-md overflow-x-auto">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px] text-center">No</TableHead>
                                        <TableHead>Nama & Email</TableHead>
                                        <TableHead>Peran</TableHead>
                                        <TableHead>NIP/Status</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(isUsersLoading || isAuthLoading) ? (
                                        [...Array(8)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                                                <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                                        <TableRow key={u.id}>
                                            <TableCell className="text-center">{u.sequenceNumber ?? i + 1}</TableCell>
                                            <TableCell><div className="flex flex-col"><span className="font-bold text-sm">{u.name}</span><span className="text-xs text-muted-foreground">{u.email}</span></div></TableCell>
                                            <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="text-xs">{u.nip || '-'}</span><span className="text-[10px] text-primary">{u.position || '-'}</span></div></TableCell>
                                            <TableCell className="text-center"><Badge variant={u.status === 'Aktif' ? 'default' : 'destructive'}>{u.status}</Badge></TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={6} className="h-24 text-center">Tidak ada data.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Tambah User</DialogTitle></DialogHeader>
                    <Form {...addForm}><form onSubmit={addForm.handleSubmit(handleCreateUser)} className="space-y-4">
                        <FormField control={addForm.control} name="name" render={({field}) => <FormItem><Label>Nama</Label><Input {...field} /></FormItem>} />
                        <FormField control={addForm.control} name="email" render={({field}) => <FormItem><Label>Email</Label><Input type="email" {...field} /></FormItem>} />
                        <FormField control={addForm.control} name="password" render={({field}) => <FormItem><Label>Password</Label><Input type="password" {...field} /></FormItem>} />
                        <Button type="submit" className="w-full" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button>
                    </form></Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
