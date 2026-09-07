"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, CheckCircle2, ArrowUpCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type BuildInfo = { v: string; d?: string };

// Sidebar footer widget: shows the running version and lets anyone check for a
// new deploy on demand. The floating <UpdateChecker/> still auto-detects in the
// background; this gives staff an explicit "am I up to date?" answer + version.
export function SidebarUpdate() {
  const { t, dateLocale } = useI18n();
  const [current, setCurrent] = useState<BuildInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"idle" | "uptodate" | "update">("idle");
  const seen = useRef<string | null>(null);

  const fetchBuild = useCallback(async (): Promise<BuildInfo | null> => {
    try {
      const res = await fetch(`/build-id.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as BuildInfo;
    } catch {
      return null;
    }
  }, []);

  // Read the running version once on mount.
  useEffect(() => {
    fetchBuild().then((b) => {
      if (!b) return;
      seen.current = b.v;
      setCurrent(b);
    });
  }, [fetchBuild]);

  const checkNow = useCallback(async () => {
    setChecking(true);
    setStatus("idle");
    const b = await fetchBuild();
    setChecking(false);
    if (!b) return;
    if (seen.current && b.v !== seen.current) {
      setStatus("update");
    } else {
      seen.current = b.v;
      setCurrent(b);
      setStatus("uptodate");
      // Clear the "up to date" note after a few seconds.
      setTimeout(() => setStatus((s) => (s === "uptodate" ? "idle" : s)), 4000);
    }
  }, [fetchBuild]);

  // A readable version label: the build date, falling back to the raw code.
  const versionLabel = (() => {
    if (current?.d) {
      const dt = new Date(current.d);
      if (!isNaN(dt.getTime())) {
        try {
          return new Intl.DateTimeFormat(dateLocale || undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          }).format(dt);
        } catch { /* fall through */ }
      }
    }
    return current?.v || "—";
  })();

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      {status === "update" ? (
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
        >
          <ArrowUpCircle className="w-4 h-4 shrink-0" />
          {t("updateReady")}
        </button>
      ) : (
        <button
          onClick={checkNow}
          disabled={checking}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 shrink-0 ${checking ? "animate-spin" : ""}`} />
          {checking ? t("updateChecking") : t("updateCheck")}
        </button>
      )}

      {status === "uptodate" && (
        <p className="flex items-center justify-center gap-1.5 mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t("updateUpToDate")}
        </p>
      )}

      <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
        {t("versionLabel")}: <span className="font-mono-en" dir="ltr">{versionLabel}</span>
      </p>
    </div>
  );
}
