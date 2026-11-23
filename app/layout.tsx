import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
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
import { THEME_STORAGE_KEY } from "@/shared/theme/types";



const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  // Load only weights used by the UI (avoid 100–300 + italic download cost).
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
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
  // Apply saved theme before paint to avoid light→dark flash on reload.
  const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${caveat.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
