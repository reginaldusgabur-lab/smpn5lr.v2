'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, ShieldCheck, LogIn, Network, Smartphone, Server, Wifi, Globe, Cpu } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { auth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

const loginSchema = z.object({
  email: z.string().email({ message: "Format email tidak valid" }),
  password: z.string().min(1, { message: "Password wajib diisi" }),
});

const resetPasswordSchema = z.object({
  email: z.string().email({ message: "Masukkan alamat email yang valid." }),
});

const BeringinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 10 C40 10 30 15 25 25 C15 25 10 35 10 45 C10 55 18 63 28 65 L28 85 L36 85 L36 65 C36 65 43 68 50 68 C57 68 64 65 64 65 L64 85 L72 85 L72 65 C82 63 90 55 90 45 C90 35 85 25 75 25 C70 15 60 10 50 10 Z" />
    <circle cx="50" cy="35" r="15" />
    <circle cx="35" cy="45" r="12" />
    <circle cx="65" cy="45" r="12" />
  </svg>
);

const ApiIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5 C50 5 85 45 50 95 C15 45 50 5 50 5 Z M50 35 C50 35 70 55 50 80 C30 55 50 35 50 35 Z" />
    <path d="M50 20 C50 20 65 40 50 60 C35 40 50 20 50 20 Z" />
  </svg>
);

export default function LoginPage() {
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router, isClient]);

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setIsLoginLoading(true);
    if (!auth) {
      toast({ variant: "destructive", title: "Gagal", description: "Layanan belum siap." });
      setIsLoginLoading(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login gagal", description: "Email atau kata sandi salah." });
      setIsLoginLoading(false);
    }
  };

  const handlePasswordReset = async (values: z.infer<typeof resetPasswordSchema>) => {
    setIsResetLoading(true);
    if (!auth) return;
    try {
      auth.languageCode = 'id';
      await sendPasswordResetEmail(auth, values.email);
      toast({ title: "Terkirim", description: `Cek email ${values.email}.` });
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mengirim email reset." });
    } finally {
      setIsResetLoading(false);
    }
  };
  
  if (!isClient || isUserLoading || user) {
      return (
        <div className="flex h-svh w-full flex-col items-center justify-center bg-white overflow-hidden">
             <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:0.4s]" />
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-foreground relative overflow-hidden">
      
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100/40 dark:bg-blue-900/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-100/30 dark:bg-indigo-900/10 blur-[120px] rounded-full" />
        
        <div className="absolute inset-0 opacity-[0.25] dark:opacity-[0.3]">
          <BeringinIcon className="absolute top-10 left-[5%] w-64 h-64 -rotate-12" />
          <ApiIcon className="absolute top-1/4 right-[10%] w-32 h-32 rotate-12" />
          <BeringinIcon className="absolute bottom-20 left-[15%] w-80 h-80 rotate-45" />
          <ApiIcon className="absolute bottom-[10%] right-[-5%] w-48 h-48 -rotate-45" />
        </div>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <Card className="w-full max-w-[370px] bg-card/95 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-2xl rounded-2xl overflow-hidden relative z-10 p-0">
          <CardHeader className="text-center space-y-0 pt-6 pb-2 relative">
            <div className="absolute top-8 left-6 opacity-10 -rotate-12">
              <Smartphone className="h-8 w-8 text-blue-600" />
            </div>
            <div className="absolute top-12 left-16 opacity-5 rotate-45">
              <Network className="h-6 w-6 text-blue-600" />
            </div>
            <div className="absolute top-8 right-6 opacity-10 rotate-12">
              <Server className="h-8 w-8 text-blue-600" />
            </div>
            <div className="absolute top-14 right-16 opacity-5 -rotate-12">
              <Wifi className="h-6 w-6 text-blue-600" />
            </div>
            <div className="absolute top-24 left-4 opacity-5 rotate-12">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div className="absolute top-24 right-4 opacity-5 -rotate-45">
              <Cpu className="h-5 w-5 text-blue-600" />
            </div>

            <div className="flex justify-center mb-0 relative z-10">
              <div className="relative w-36 h-36 transition-transform duration-500 hover:scale-105">
                <Image src="/logo-3d.png" alt="Logo E-SPENLI" fill sizes="144px" className="object-contain" priority />
              </div>
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter text-blue-600 dark:text-blue-400 leading-none uppercase -mt-2">E-SPENLI</CardTitle>
            <CardDescription className="font-bold text-muted-foreground/60 text-[10px] mt-1 tracking-tight">Aplikasi absensi online</CardDescription>

            <div className="pt-4 space-y-2">
               <div className="flex flex-col items-center gap-1">
                  <div className="bg-blue-600/10 rounded-full p-2 border border-blue-500/20 mb-1">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight leading-none">SMP NEGERI 5 LANGKE REMBONG</p>
               </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-2">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Email</Label>
                      <FormControl>
                        <Input placeholder="nama@email.com" {...field} className="h-11 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border-transparent focus:border-blue-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all font-bold shadow-none px-4 text-sm" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="password" className="text-[10px] font-bold text-slate-500">Kata sandi</Label>
                    <DialogTrigger asChild>
                      <button type="button" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Lupa sandi?</button>
                    </DialogTrigger>
                  </div>
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <FormControl>
                            <Input type={showLoginPass ? 'text' : 'password'} placeholder="••••••••••••" {...field} className="h-11 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border-transparent focus:border-blue-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all font-bold shadow-none px-4 pr-12 text-sm" />
                          </FormControl>
                          <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground/30 hover:bg-transparent shadow-none" onClick={() => setShowLoginPass(!showLoginPass)}>
                            {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full h-11 text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98] bg-blue-600 hover:bg-blue-700 text-white mt-4 flex items-center justify-center gap-2" disabled={isLoginLoading}>
                  {isLoginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-3.5 w-3.5" />Masuk sekarang</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DialogContent className="rounded-2xl border-none p-8 shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black text-xl tracking-tight text-blue-600 uppercase">Pemulihan Sandi</DialogTitle>
            <DialogDescription className="font-bold text-xs text-muted-foreground mt-2">Masukkan email terdaftar Anda untuk pemulihan.</DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handlePasswordReset)}>
              <div className="py-6">
                <FormField
                  control={resetForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1 uppercase">Email Terdaftar</Label>
                      <FormControl>
                        <Input placeholder="email@anda.com" {...field} className="h-12 rounded-xl bg-slate-100 border-transparent focus:bg-white shadow-none font-bold" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isResetLoading} className="w-full h-12 rounded-xl font-black tracking-widest bg-blue-600 shadow-lg uppercase text-xs">
                  {isResetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kirim Tautan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <footer className="mt-8 text-center flex flex-col items-center gap-1 opacity-20 relative z-10 transition-opacity hover:opacity-50">
        <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-[0.25em] uppercase">SMP NEGERI 5 LANGKE REMBONG</p>
        <p className="text-[9px] font-bold text-slate-500 tracking-widest">©2026 | All Rights Reserved.</p>
      </footer>
    </div>
  );
}
