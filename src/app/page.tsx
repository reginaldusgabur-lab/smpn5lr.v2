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

// Komponen siluet Pohon Beringin
const BeringinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M100 20 C140 20, 175 40, 185 85 C190 120, 160 145, 100 155 C40 145, 10 120, 15 85 C25 40, 60 20, 100 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M100 45 C125 45, 145 60, 150 85 C150 110, 125 125, 100 135 C75 125, 50 110, 50 85 C50 60, 75 45, 100 45" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <path d="M100 135 L100 185 M85 140 L75 175 M115 140 L125 175" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Komponen siluet Api
const ApiIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 10 C50 10, 65 35, 50 65 C35 35, 50 10, 50 10" fill="currentColor"/>
    <path d="M35 25 C35 25, 25 40, 40 60" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <path d="M65 25 C65 25, 75 40, 60 60" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export default function LoginPage() {
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

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
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setIsLoginLoading(true);
    if (!auth) {
      toast({ variant: "destructive", title: "Layanan belum siap", description: "Layanan otentikasi belum tersedia." });
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
      toast({
        title: "Link pemulihan terkirim",
        description: `Periksa kotak masuk & spam di ${values.email}.`
      });
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal mengirim email reset. Pastikan email terdaftar."
      });
    } finally {
      setIsResetLoading(false);
    }
  };
  
  if (isUserLoading || user) {
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
      
      {/* Scattered Pattern Background Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.08] overflow-hidden">
        {/* Pohon-pohon Beringin Tersebar */}
        <BeringinIcon className="absolute top-[-5%] left-[-5%] w-[400px] h-[400px] text-primary -rotate-12" />
        <BeringinIcon className="absolute top-10 right-[-10%] w-[350px] h-[350px] text-primary rotate-45" />
        <BeringinIcon className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] text-primary rotate-12" />
        <BeringinIcon className="absolute bottom-20 right-0 w-[300px] h-[300px] text-primary -rotate-45" />
        
        {/* Elemen Api Tersebar */}
        <ApiIcon className="absolute top-[20%] left-[40%] w-24 h-24 text-primary opacity-50" />
        <ApiIcon className="absolute top-[60%] right-[30%] w-32 h-32 text-primary rotate-12" />
        <ApiIcon className="absolute top-[10%] left-[20%] w-16 h-16 text-primary -rotate-12" />
        <ApiIcon className="absolute bottom-[20%] right-[10%] w-20 h-20 text-primary rotate-45" />
        <ApiIcon className="absolute bottom-[40%] left-[-5%] w-28 h-28 text-primary -rotate-45" />
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <Card className="w-full max-w-[380px] bg-card/90 backdrop-blur-sm border border-muted-foreground/10 shadow-2xl rounded-3xl overflow-hidden relative z-10">
          <CardHeader className="text-center space-y-0 pt-6 pb-2">
            <div className="flex justify-center mb-1">
              <div className="relative w-36 h-36">
                <Image
                  src="/logo-3d.png"
                  alt="Logo E-SPENLI"
                  fill
                  sizes="144px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <CardTitle className="text-4xl font-black tracking-tight text-primary leading-none uppercase">E-SPENLI</CardTitle>
            <CardDescription className="font-bold text-muted-foreground/60 text-sm mt-1 tracking-tight">
              Aplikasi absensi online
            </CardDescription>

            <div className="pt-4 space-y-2">
               <div className="flex items-center gap-3 w-full max-w-[220px] mx-auto">
                  <div className="h-px bg-muted-foreground/20 grow" />
                  <div className="bg-primary rounded-full p-1 shadow-sm">
                     <ShieldCheck className="h-3 w-3 text-white" />
                  </div>
                  <div className="h-px bg-muted-foreground/20 grow" />
               </div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] leading-none opacity-90">SMP NEGERI 5 LANGKE REMBONG</p>
                  <p className="text-[10px] font-bold text-muted-foreground/60 leading-none mt-1">Sistem Absensi Online</p>
               </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-6 pt-2">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <Label className="text-sm font-bold text-foreground ml-1">Alamat email</Label>
                      <FormControl>
                        <Input 
                          placeholder="nama@email.com" 
                          {...field} 
                          className="h-12 rounded-xl bg-muted/20 border-muted-foreground/10 focus:bg-background transition-all font-bold shadow-none text-foreground"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-0.5 px-1">
                    <Label htmlFor="password" className="text-sm font-bold text-foreground">Kata sandi</Label>
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs font-bold text-primary hover:opacity-70 transition-opacity">
                        Lupa sandi?
                      </button>
                    </DialogTrigger>
                  </div>
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <FormControl>
                            <Input 
                              type={showLoginPass ? 'text' : 'password'} 
                              placeholder="Masukkan kata sandi" 
                              {...field} 
                              className="h-12 rounded-xl bg-muted/20 border-muted-foreground/10 focus:bg-background transition-all font-bold shadow-none text-foreground"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent shadow-none"
                            onClick={() => setShowLoginPass(!showLoginPass)}
                          >
                            {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.97] bg-primary hover:bg-primary/90 mt-2 flex items-center justify-center gap-2" 
                  disabled={isLoginLoading}
                >
                  {isLoginLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      <LogIn className="h-4 w-4" />
                      Masuk sekarang
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DialogContent className="rounded-3xl border-none p-8 shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black text-xl tracking-tighter text-primary uppercase">Atur ulang sandi</DialogTitle>
            <DialogDescription className="font-bold text-xs text-muted-foreground mt-1">
              Masukkan email terdaftar Anda untuk pemulihan.
            </DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handlePasswordReset)}>
              <div className="py-6">
                <FormField
                  control={resetForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="reset-email" className="text-[10px] font-black tracking-widest text-muted-foreground ml-1 uppercase">Email terdaftar</Label>
                      <FormControl>
                        <Input 
                          id="reset-email" 
                          placeholder="email@anda.com" 
                          {...field} 
                          className="h-12 rounded-xl bg-muted/20 border-muted-foreground/10 focus:bg-background shadow-none font-bold"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isResetLoading} 
                  className="w-full h-12 rounded-xl font-black tracking-widest shadow-lg shadow-primary/20 uppercase text-xs"
                >
                  {isResetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kirim link pemulihan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <footer className="mt-4 text-center flex flex-col items-center gap-1 opacity-40 relative z-10">
        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">
          SMP NEGERI 5 LANGKE REMBONG
        </p>
        <p className="text-[9px] font-bold text-muted-foreground tracking-widest">
          ©2026 | All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
