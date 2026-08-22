
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "E-SPENLI",
  description: "Sistem Informasi Absensi SMPN 5 Langke Rembong",
  manifest: "/manifest.json",
  icons: [], // Menghapus metadata ikon agar tidak didobel oleh sistem OS
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "E-SPENLI",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <body className={`${inter.className} bg-white antialiased`}>
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
