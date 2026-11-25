import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Providers from "@/components/Providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SessionManager from "@/components/SessionManager";
import NexusAgent from "@/components/NexusAgent";
import ForcePasswordChangeModal from "@/components/ForcePasswordChangeModal";
import { CHUNK_RECOVERY_SCRIPT } from "@/lib/chunk-recovery";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "SLTS Nexus - Workflow management system",
  description: "Next-Gen Workflow & OSP Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SLTSERP Mobile",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'SLTS Nexus - Workflow management system',
    description: 'Next-Gen Workflow & OSP Management System',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'SLTS Nexus Logo',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Reloads once when a JavaScript file from an older deploy is gone (see src/lib/chunk-recovery.ts) */}
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <Providers>
            <ThemeProvider>
              <SessionManager />
              {children}
              <NexusAgent />
              <ForcePasswordChangeModal />
            </ThemeProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
// Trigger HMR cache reload

