"use client";

import { useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ServiceWorkerRegistration />
      {children}
    </I18nProvider>
  );
}
