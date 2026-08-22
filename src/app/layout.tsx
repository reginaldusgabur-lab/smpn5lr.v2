import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { ThemeProvider } from "@/components/theme-provider";
import PwaInstaller from '@/components/pwa-installer';
import PwaUpdater from '@/components/pwa-updater';

export const metadata: Metadata = {
  title: 'E-SPENLI',
  description: 'Aplikasi Absensi Digital untuk SMPN 5 Langke Rembong',
  manifest: '/manifest.json',
  applicationName: 'E-SPENLI',
  icons: [], // Diagnostic: clear all icons to trace double splash
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFFFFF', // Ice White Force
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="light" style={{ colorScheme: 'light' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-white text-foreground" suppressHydrationWarning style={{ colorScheme: 'light', backgroundColor: 'white' }}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <FirebaseClientProvider>
            {children}
          </FirebaseClientProvider>
          <Toaster />
          <PwaInstaller />
          <PwaUpdater />
        </ThemeProvider>
      </body>
    </html>
  );
}
