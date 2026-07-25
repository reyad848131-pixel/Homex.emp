"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ThemePref = "auto" | "light" | "dark";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Apply the resolved theme to <html>. "auto" follows the device.
function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "auto" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function DarkModeToggle() {
  const [pref, setPref] = useState<ThemePref>("auto");
  const { t } = useI18n();

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as ThemePref) || "auto";
    setPref(stored);
    applyTheme(stored);
  }, []);

  // While on "auto", react live to the device switching light/dark.
  useEffect(() => {
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const cycle = useCallback(() => {
    // auto → light → dark → auto
    const next: ThemePref = pref === "auto" ? "light" : pref === "light" ? "dark" : "auto";
    setPref(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }, [pref]);

  const icon = pref === "auto" ? <Monitor className="w-4 h-4" /> : pref === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />;
  const label = pref === "auto" ? t("autoMode") : pref === "dark" ? t("darkModeOn") : t("lightModeOn");

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors font-semibold"
    >
      {icon}
      {label}
    </button>
  );
}
