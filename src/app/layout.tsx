import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PageTransitionProvider } from "@/components/layout/page-transition";
import { Navbar } from "@/components/layout/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Training Analyst - AI-Powered Cycling Coach",
  description: "Personalized training insights powered by AI. Analyze your training data and get specific, actionable recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen flex flex-col`}
      >
        <ThemeProvider>
          <Navbar />
          <PageTransitionProvider>
            <div className="flex-1 min-h-0 flex flex-col">
              {children}
            </div>
          </PageTransitionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
