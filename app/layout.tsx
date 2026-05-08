import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Management",
  description: "Sistem manajemen stok multivariasi.",
  applicationName: "Stock Management",
  appleWebApp: {
    capable: true,
    title: "Stock",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ff4f00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <ServiceWorkerRegistration />
          <AppShell>
            {children}
          </AppShell>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
