'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, ShieldCheck, LogIn } from 'lucide-react';
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

// Siluet Pohon Beringin (Solid)
const BeringinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M100 20 C140 20, 185 45, 185 90 C185 125, 150 145, 100 155 C50 145, 15 125, 15 90 C15 45, 60 20, 100 20 Z" />
    <path d="M95 145 H105 V190 H95 V145 Z" />
  </svg>
);

// Siluet Api (Solid)
const ApiIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5 C50 5, 80 40, 50 95 C20 40, 50 5, 50 5 Z" />
    <path d="M35 25 C35 25, 20 45, 45 65 Z" />
    <path d="M65 25 C65 25, 80 45, 55 65 Z" />
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
      
      {/* Background patterns & watermarks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100/40 dark:bg-blue-900/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-100/30 dark:bg-indigo-900/10 blur-[120px] rounded-full" />
        
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <BeringinIcon className="absolute top-10 left-[5%] w-64 h-64 -rotate-12" />
          <ApiIcon className="absolute top-1/4 right-[10%] w-32 h-32 rotate-12" />
          <BeringinIcon className="absolute bottom-20 left-[15%] w-80 h-80 rotate-45" />
          <ApiIcon className="absolute bottom-[10%] right-[-5%] w-48 h-48 -rotate-45" />
        </div>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <Card className="w-full max-w-[420px] bg-card/95 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden relative z-10 p-4 sm:p-6">
          <CardHeader className="text-center space-y-0 pt-4 pb-2">
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32 transition-transform duration-500 hover:scale-105">
                <Image src="/logo-3d.png" alt="Logo E-SPENLI" fill sizes="128px" className="object-contain" priority />
              </div>
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter text-blue-600 dark:text-blue-400 leading-none uppercase">E-SPENLI</CardTitle>
            <CardDescription className="font-bold text-muted-foreground/50 text-sm mt-2 tracking-tight">Aplikasi absensi online</CardDescription>

            <div className="pt-8 space-y-3">
               <div className="flex items-center gap-3 w-full max-w-[280px] mx-auto opacity-40">
                  <div className="h-[1px] bg-muted-foreground/30 grow" />
                  <div className="bg-blue-600 rounded-full p-1.5"><ShieldCheck className="h-3 w-3 text-white" /></div>
                  <div className="h-[1px] bg-muted-foreground/30 grow" />
               </div>
               <div className="space-y-1">
                  <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] leading-none">SMP NEGERI 5 LANGKE REMBONG</p>
                  <p className="text-[10px] font-bold text-muted-foreground/40 leading-none mt-1 uppercase tracking-widest">Sistem Absensi Online</p>
               </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Alamat email</Label>
                      <FormControl>
                        <Input placeholder="smpn5lr@gmail.com" {...field} className="h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-900 transition-all font-bold shadow-none px-5" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="password" className="text-sm font-bold text-slate-700 dark:text-slate-300">Kata sandi</Label>
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Lupa sandi?</button>
                    </DialogTrigger>
                  </div>
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <FormControl>
                            <Input type={showLoginPass ? 'text' : 'password'} placeholder="••••••••••••" {...field} className="h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-900 transition-all font-bold shadow-none px-5 pr-12" />
                          </FormControl>
                          <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-4 text-muted-foreground/50 hover:bg-transparent shadow-none" onClick={() => setShowLoginPass(!showLoginPass)}>
                            {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full h-14 text-sm font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] bg-blue-600 hover:bg-blue-700 text-white mt-2 flex items-center justify-center gap-2" disabled={isLoginLoading}>
                  {isLoginLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn className="h-4 w-4" />Masuk sekarang</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DialogContent className="rounded-[2rem] border-none p-8 shadow-2xl max-w-sm">
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
                      <Label htmlFor="reset-email" className="text-[10px] font-black tracking-widest text-muted-foreground ml-1 uppercase">Email Terdaftar</Label>
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
        <p className="text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-[0.25em] uppercase">SMP NEGERI 5 LANGKE REMBONG</p>
        <p className="text-[10px] font-bold text-slate-500 tracking-widest">©2026 | All Rights Reserved.</p>
      </footer>
    </div>
  );
}