"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const CHECK_INTERVAL = 60_000;

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [initialVersion, setInitialVersion] = useState<string | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = await res.json();
      if (!initialVersion) {
        setInitialVersion(version);
      } else if (version !== initialVersion) {
        setUpdateAvailable(true);
      }
    } catch {}
  }, [initialVersion]);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkVersion]);

  useEffect(() => {
    const onFocus = () => checkVersion();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkVersion]);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <button
        onClick={() => window.location.reload()}
        className="pointer-events-auto flex items-center gap-2 px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl text-sm font-bold animate-bounce hover:scale-105 transition-transform"
      >
        <RefreshCw className="w-4 h-4" />
        تحديث متاح — اضغط للتحديث
      </button>
    </div>
  );
}
