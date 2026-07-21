"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const CHECK_INTERVAL = 60_000;

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/build-id.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { v } = await res.json();
        if (!initialVersion.current) {
          initialVersion.current = v;
        } else if (v !== initialVersion.current) {
          setUpdateAvailable(true);
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onFocus = async () => {
      try {
        const res = await fetch(`/build-id.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { v } = await res.json();
        if (initialVersion.current && v !== initialVersion.current) {
          setUpdateAvailable(true);
        }
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
            setUpdateAvailable(true);
          }
        });
      });

      reg.update().catch(() => {});
      const swInterval = setInterval(() => reg.update().catch(() => {}), CHECK_INTERVAL * 2);
      return () => clearInterval(swInterval);
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      setUpdateAvailable(true);
    });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <button
        onClick={() => window.location.reload()}
        className="pointer-events-auto flex items-center gap-2 px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl text-sm font-bold animate-bounce hover:scale-105 transition-transform"
      >
        <RefreshCw className="w-4 h-4" />
        {t("updateAvailable")}
      </button>
    </div>
  );
}
