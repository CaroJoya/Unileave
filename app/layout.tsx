// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from 'next/dynamic';
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // ✅ Improves font loading
});

export const metadata: Metadata = {
  title: "UniLeave - University Leave Management System",
  description: "Manage university leave requests efficiently",
};

// ✅ FIXED: Proper dynamic import with correct return type
const Navbar = dynamic(
  () => import("@/components/layout/Navbar").then(mod => mod.default),
  {
    ssr: true,
    loading: () => <div className="h-16 bg-white border-b" />,
  }
);

// ✅ FIXED: Proper dynamic import for Providers
const Providers = dynamic(
  () => import("@/components/providers/Providers").then(mod => mod.Providers),
  {
    ssr: true,
  }
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        {/* ✅ Preconnect to Firebase domain */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL} />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-gray-50">{children}</main>
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  );
}