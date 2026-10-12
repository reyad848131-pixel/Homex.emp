import type { Metadata } from "next";
// Self-hosted fonts (via @fontsource) — bundled with the app so the build never
// depends on fetching Google Fonts at build time (that fetch was intermittently
// failing and silently blocking deploys). The families "Cairo"/"Montserrat"
// registered here are what globals.css falls back to.
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { UpdateChecker } from "@/components/update-checker";

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
    <html lang="ar" dir="rtl">
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
