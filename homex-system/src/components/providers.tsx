"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

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
    <SessionProvider>
      <ServiceWorkerRegistration />
      {children}
    </SessionProvider>
  );
}
