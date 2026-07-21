import type { Metadata } from "next";
import { Cairo, Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { UpdateChecker } from "@/components/update-checker";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Homex | نظام عروض الأسعار",
  description: "نظام إدارة عروض الأسعار الداخلي - Homex",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Homex",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${montserrat.variable}`}>
      <head>
        <meta name="theme-color" content="#171717" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="font-cairo antialiased bg-stone-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
        <Providers>
          {children}
          <UpdateChecker />
        </Providers>
      </body>
    </html>
  );
}
