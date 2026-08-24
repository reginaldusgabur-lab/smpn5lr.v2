'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
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

export default function LoginPage() {
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

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
             <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s]" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-duration:0.8s] [animation-delay:0.3s]" />
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-foreground relative overflow-hidden">
      {/* Background Watermark Pohon - Eksklusif Halaman Login */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.15] dark:opacity-[0.2]">
        <div className="absolute -right-20 -bottom-20 rotate-12 scale-150">
          <svg width="600" height="600" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M24 44V34" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 34C24 34 38 32 38 24C38 16 24 14 24 14C24 14 10 16 10 24C10 32 24 34 24 34Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 24C24 24 34 22 34 16C34 10 24 8 24 8C24 8 14 10 14 16C14 22 24 24 24 24Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 14C24 14 30 12 30 8C30 4 24 2 24 2C24 2 18 4 18 8C18 12 24 14 24 14Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="absolute -left-20 -top-20 -rotate-12 scale-125">
          <svg width="500" height="500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M24 44V34" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 34C24 34 38 32 38 24C38 16 24 14 24 14C24 14 10 16 10 24C10 32 24 34 24 34Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 24C24 24 34 22 34 16C34 10 24 8 24 8C24 8 14 10 14 16C14 22 24 24 24 24Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 14C24 14 30 12 30 8C30 4 24 2 24 2C24 2 18 4 18 8C18 12 24 14 24 14Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-md border border-muted-foreground/10 shadow-2xl rounded-[2rem] overflow-hidden transition-all duration-300 relative z-10">
          <CardHeader className="text-center space-y-2 pt-10 pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative w-32 h-32 transition-all duration-500 hover:scale-105">
                <Image
                  src="/logo-3d.png"
                  alt="Logo E-SPENLI"
                  fill
                  sizes="128px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter text-primary uppercase">E-SPENLI</CardTitle>
            <CardDescription className="font-bold text-muted-foreground/80 text-sm px-2">
              Aplikasi absensi digital
            </CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-12 pt-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label className="text-sm font-bold text-muted-foreground ml-1">Alamat email</Label>
                      <FormControl>
                        <Input 
                          placeholder="nama@email.com" 
                          {...field} 
                          className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/5 focus:bg-background transition-all font-bold shadow-none"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password" className="text-sm font-bold text-muted-foreground ml-1">Kata sandi</Label>
                    <DialogTrigger asChild>
                      <button type="button" className="text-sm font-bold text-primary hover:opacity-70 transition-opacity">
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
                              className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/5 focus:bg-background transition-all font-bold shadow-none"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute inset-y-0 right-0 h-full px-4 text-muted-foreground hover:bg-transparent shadow-none"
                            onClick={() => setShowLoginPass(!showLoginPass)}
                          >
                            {showLoginPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            <span className="sr-only">Tampilkan kata sandi</span>
                          </Button>
                        </div>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-16 text-base font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.97] bg-primary hover:bg-primary/90 mt-6" 
                  disabled={isLoginLoading}
                >
                  {isLoginLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Masuk sekarang"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DialogContent className="rounded-[2rem] border-none p-10 shadow-2xl max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl tracking-tighter text-primary uppercase">Atur ulang sandi</DialogTitle>
            <DialogDescription className="font-bold text-xs text-muted-foreground mt-2">
              Masukkan email terdaftar Anda untuk menerima tautan pemulihan.
            </DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handlePasswordReset)}>
              <div className="py-8">
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
                          className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/5 focus:bg-background shadow-none font-bold"
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
                  className="w-full h-14 rounded-2xl font-black tracking-widest shadow-xl shadow-primary/20 uppercase"
                >
                  {isResetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kirim link pemulihan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <footer className="mt-12 text-center flex flex-col items-center gap-1.5 opacity-60 relative z-10">
        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">
          SMP NEGERI 5 LANGKE REMBONG
        </p>
        <p className="text-[9px] font-bold text-muted-foreground/80 tracking-widest">
          ©2026 | All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
