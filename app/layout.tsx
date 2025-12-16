import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ConditionalHeader from "./components/ConditionalHeader";
import Footer from "@/shared/components/layout/FooterNext";
import GlobalComponents from "./components/GlobalComponents";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ConnectAfrik - African Community Platform",
  description: "The premier platform for Africans worldwide to share political insights, celebrate cultural diversity, and build meaningful connections",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <Providers>
          <div className="min-h-screen bg-white">
            <ConditionalHeader />
            {children}
            <Footer />
          </div>
          <GlobalComponents />
        </Providers>
      </body>
    </html>
  );
}
