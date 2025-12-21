import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // Removed Inter as it was not used or replaced
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ThemeSettings from "@/components/ThemeSettings";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nexusErp - Construction ERP",
  description: "OSP Construction Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <ThemeProvider>
            {children}
            <ThemeSettings />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
