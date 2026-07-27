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
  // All icons resolve through the dynamic /api/app-icon route so a custom icon
  // uploaded in Settings shows up in the browser tab, bookmarks and on newly
  // added home-screen shortcuts. (There is no app/favicon.ico anymore — a
  // static favicon file would override this and always show the default.)
  icons: {
    icon: [{ url: "/api/app-icon", type: "image/png" }],
    shortcut: ["/api/app-icon"],
    apple: [{ url: "/api/app-icon" }],
  },
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
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||((t===null||t==="auto")&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="font-cairo antialiased bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
        <Providers>
          {children}
          <UpdateChecker />
        </Providers>
      </body>
    </html>
  );
}
