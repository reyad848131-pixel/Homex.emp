"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, useTranslatedMonths } from "@/lib/i18n";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, "0");

// Each month is split into exactly 4 business weeks:
// week 1: days 1–7, week 2: 8–14, week 3: 15–21, week 4: 22–end of month.
function monthWeeks(year: number, month0: number): { from: number; to: number }[] {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return [
    { from: 1, to: 7 },
    { from: 8, to: 14 },
    { from: 15, to: 21 },
    { from: 22, to: lastDay },
  ];
}

/**
 * Hierarchical date navigator: pick a Year → then a Month → then narrow to one
 * of the month's four weeks or to a specific day. Emits the resulting
 * delivery-date range (or null for "all time") plus a readable label.
 */
export function DateDrillNav({
  onChange,
  stopAtMonth = false,
}: {
  onChange: (range: DateRange | null, label: string) => void;
  // When true, the navigator stops at month level (no week/day rows) — used
  // where a calendar below already handles days.
  stopAtMonth?: boolean;
}) {
  const { t } = useI18n();
  const months = useTranslatedMonths();
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [year, setYear] = useState<number | null>(null);
  const [month0, setMonth0] = useState<number | null>(null); // 0-11
  const [week, setWeek] = useState<number | null>(null);      // 0-3
  const [day, setDay] = useState<number | null>(null);        // 1-31
  const [yearBase, setYearBase] = useState(now.getFullYear());

  const weeks = useMemo(
    () => (year !== null && month0 !== null ? monthWeeks(year, month0) : []),
    [year, month0]
  );

  const dayStr = useCallback(
    (d: number) => `${year}-${pad((month0 ?? 0) + 1)}-${pad(d)}`,
    [year, month0]
  );

  useEffect(() => {
    if (year === null) { onChange(null, t("allMonths")); return; }
    if (month0 === null) { onChange({ from: `${year}-01-01`, to: `${year}-12-31` }, String(year)); return; }
    const monthName = months[month0];
    if (day !== null) {
      onChange({ from: dayStr(day), to: dayStr(day) }, `${year} › ${monthName} › ${day}`);
      return;
    }
    if (week !== null && weeks[week]) {
      const w = weeks[week];
      onChange({ from: dayStr(w.from), to: dayStr(w.to) }, `${year} › ${monthName} › ${t("weekLabel")} ${week + 1}`);
      return;
    }
    const last = new Date(year, month0 + 1, 0).getDate();
    onChange({ from: dayStr(1), to: dayStr(last) }, `${monthName} ${year}`);
  }, [year, month0, week, day, weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (active: boolean) =>
    cn(
      "rounded-lg text-sm font-bold border transition-all",
      active
        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-sm"
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
    );

  const years = [yearBase - 2, yearBase - 1, yearBase, yearBase + 1, yearBase + 2];

  const reset = (level: "all" | "year" | "month") => {
    if (level === "all") { setYear(null); setMonth0(null); setWeek(null); setDay(null); }
    if (level === "year") { setMonth0(null); setWeek(null); setDay(null); }
    if (level === "month") { setWeek(null); setDay(null); }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-4">
      {/* Years */}
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
        <button onClick={() => reset("all")} className={cn(chip(year === null), "px-3 py-1.5 shrink-0")}>
          {t("allMonths")}
        </button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 shrink-0" />
        <button onClick={() => setYearBase((y) => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0" aria-label="prev years">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5 overflow-x-auto flex-1 justify-center">
          {years.map((y) => (
            <button key={y} onClick={() => { setYear(y); reset("year"); }}
              className={cn(chip(year === y), "px-3.5 py-1.5 font-mono-en shrink-0")}>
              {y}
            </button>
          ))}
        </div>
        <button onClick={() => setYearBase((y) => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0" aria-label="next years">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Months */}
      {year !== null && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-1.5">
          <button onClick={() => reset("year")} className={cn(chip(month0 === null), "px-3 py-1.5")}>
            {t("wholeYear")}
          </button>
          {months.map((m, i) => (
            <button key={i} onClick={() => { setMonth0(i); reset("month"); }}
              className={cn(chip(month0 === i), "px-3 py-1.5 min-w-[68px]")}>
              {m} <span className="font-mono-en opacity-60">({i + 1})</span>
            </button>
          ))}
        </div>
      )}

      {/* 4 weeks + days */}
      {!stopAtMonth && year !== null && month0 !== null && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
          <button onClick={() => reset("month")} className={cn(chip(week === null && day === null), "px-3 py-1.5 mb-1")}>
            {t("wholeMonth")}
          </button>
          {weeks.map((w, wi) => (
            <div key={wi} className="flex items-center gap-2">
              <button onClick={() => { setWeek(wi); setDay(null); }}
                className={cn(chip(week === wi && day === null), "px-2.5 py-2 text-xs shrink-0 w-24 text-center leading-tight")}>
                {t("weekLabel")} {wi + 1}
                <span className="block text-[10px] opacity-70 font-mono-en">{w.from}–{w.to}</span>
              </button>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: w.to - w.from + 1 }, (_, k) => w.from + k).map((d) => {
                  const active = day === d;
                  const isToday = dayStr(d) === todayKey;
                  return (
                    <button key={d} onClick={() => { setDay(active ? null : d); setWeek(null); }}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold border transition-all",
                        active
                          ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500",
                        isToday && !active && "ring-1 ring-blue-400"
                      )}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
