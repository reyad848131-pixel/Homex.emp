"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Globe, Moon, Sun, Monitor } from "lucide-react";

type ThemePref = "auto" | "light" | "dark";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "auto" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export default function LoginPage() {
  const [civilId, setCivilId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const { t, locale, setLocale, dir } = useI18n();

  // Show a clear notice when redirected here by an expired session.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired") === "1") setExpired(true);
  }, []);

  // Theme toggle (auto → light → dark), shared with the dashboard via the
  // "theme" localStorage key the root layout reads on first paint.
  const [theme, setTheme] = useState<ThemePref>("auto");
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as ThemePref) || "auto";
    setTheme(stored);
    applyTheme(stored);
  }, []);
  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemePref = prev === "auto" ? "light" : prev === "light" ? "dark" : "auto";
      localStorage.setItem("theme", next);
      applyTheme(next);
      return next;
    });
  }, []);
  const themeIcon = theme === "auto" ? <Monitor className="w-4 h-4" /> : theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />;
  const themeLabel = theme === "auto" ? t("autoMode") : theme === "dark" ? t("darkModeOn") : t("lightModeOn");

  const messageFor = (data: { code?: string; error?: string; retryAfter?: number; remaining?: number }) => {
    if (data.code === "locked") {
      const mins = data.retryAfter ?? 15;
      return `${t("accountLocked")}. ${t("tryAfterMinutes")} ${mins} ${t("minutesUnitShort")}`;
    }
    if (data.code === "invalid" && typeof data.remaining === "number" && data.remaining > 0) {
      return `${t("invalidCredentials")} — ${data.remaining} ${t("attemptsRemainingBefore")}`;
    }
    if (data.code === "invalid") return t("invalidCredentials");
    return data.error || t("invalidCredentials");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!civilId || !password) {
      setError(t("loginError"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ civilId, password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        window.location.href = "/";
      } else {
        setError(messageFor(data));
        setLoading(false);
      }
    } catch (e: any) {
      setError(`${t("connectionError")}: ${e?.message || String(e)}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e7e8e2] dark:bg-gray-950 flex items-center justify-center p-4 transition-colors" dir={dir}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">homex</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 tracking-[0.14em] uppercase mt-1 font-medium">
            Quotation Management System
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-gray-400 dark:text-gray-500 mb-2 font-medium">
              {t("employeeLogin")}
            </p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("signIn")}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("enterCredentials")}</p>
          </div>

          {expired && (
            <div className="mb-4 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm text-center font-semibold px-3 py-2.5">
              {t("sessionExpiredBanner")}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{t("civilId")}</label>
              <input
                type="text"
                inputMode="numeric"
                value={civilId}
                onChange={(e) => setCivilId(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-gray-900 dark:focus:border-gray-400 transition-colors"
                placeholder="••••"
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-gray-900 dark:focus:border-gray-400 transition-colors"
                placeholder="••••"
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold py-3.5 rounded hover:bg-gray-800 dark:hover:bg-white transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? t("loggingIn") : t("login")}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col">
            <button
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-semibold"
            >
              <Globe className="w-4 h-4" />
              {t("language")}
            </button>
            <button
              onClick={cycleTheme}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-semibold"
            >
              {themeIcon}
              {themeLabel}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6 font-mono">
          Homex Internal System v2.0
        </p>
      </div>
    </div>
  );
}
