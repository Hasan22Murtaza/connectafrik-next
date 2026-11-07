import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Providers } from "./providers";
import ConditionalHeader from "./components/ConditionalHeader";
import ConditionalFooter from "./components/ConditionalFooter";
import ConditionalAppSidebar from "./components/ConditionalAppSidebar";
import GlobalComponents from "./components/GlobalComponents";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getSeoMetadataBase,
  organizationJsonLd,
  SEO_DEFAULT_TITLE,
  SEO_SITE_NAME,
  websiteJsonLd,
  getRootMetadata,
} from "@/lib/seo";



const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: [
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900"
  ],
  style: ["normal", "italic"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getSeoMetadataBase(),
  ...getRootMetadata(),
  title: {
    default: SEO_DEFAULT_TITLE,
    template: `%s | ${SEO_SITE_NAME}`,
  },
  applicationName: SEO_SITE_NAME,
  icons: {
    icon: [
      { url: "/assets/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/assets/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/assets/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} antialiased`}
      >
        <Providers>
          <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
          <div className="min-h-screen w-full mx-auto min-[1950px]:max-w-[1800px] ">
            <ConditionalHeader />
            <ConditionalAppSidebar>{children}</ConditionalAppSidebar>
            <ConditionalFooter />
          </div>
          <GlobalComponents />
        </Providers>
      </body>
    </html>
  );
}
