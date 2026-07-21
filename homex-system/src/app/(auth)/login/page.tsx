"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export default function LoginPage() {
  const [civilId, setCivilId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t, locale, setLocale, dir } = useI18n();

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
        setError(data.error || t("invalidCredentials"));
        setLoading(false);
      }
    } catch (e: any) {
      setError(`${t("connectionError")}: ${e?.message || String(e)}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e7e8e2] flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">homex</h1>
          <p className="text-xs text-gray-500 tracking-[0.14em] uppercase mt-1 font-medium">
            Quotation Management System
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-gray-400 mb-2 font-medium">
              {t("employeeLogin")}
            </p>
            <h2 className="text-xl font-bold text-gray-900">{t("signIn")}</h2>
            <p className="text-sm text-gray-500 mt-1">{t("enterCredentials")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("civilId")}</label>
              <input
                type="text"
                value={civilId}
                onChange={(e) => setCivilId(e.target.value)}
                className="w-full border border-gray-200 bg-white text-gray-900 rounded px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="••••"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 bg-white text-gray-900 rounded px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? t("loggingIn") : t("login")}
            </button>
          </form>

          <button
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="flex items-center justify-center gap-2 w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-semibold"
          >
            <Globe className="w-4 h-4" />
            {t("language")}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-mono">
          Homex Internal System v2.0
        </p>
      </div>
    </div>
  );
}
