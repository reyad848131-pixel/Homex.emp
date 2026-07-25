"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, useTranslatedMonths } from "@/lib/i18n";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Calendar weeks for a month, starting on Saturday (Gulf convention).
function monthWeeks(year: number, month0: number): { date: Date; inMonth: boolean }[][] {
  const first = new Date(year, month0, 1);
  const startCol = (first.getDay() + 1) % 7; // Sat = 0
  const gridStart = new Date(year, month0, 1 - startCol);
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row: { date: Date; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      row.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
    // Stop once we've passed the month and completed a week.
    if (cursor.getMonth() !== month0 && cursor > new Date(year, month0 + 1, 0)) break;
  }
  return weeks;
}

/**
 * Hierarchical date navigator: pick a Year → then a Month → then narrow to a
 * specific Week or Day. Emits the resulting delivery-date range (or null for
 * "all time") plus a human-readable label.
 */
export function DateDrillNav({
  onChange,
}: {
  onChange: (range: DateRange | null, label: string) => void;
}) {
  const { t, locale } = useI18n();
  const months = useTranslatedMonths();
  const now = new Date();

  const [year, setYear] = useState<number | null>(null);
  const [month0, setMonth0] = useState<number | null>(null); // 0-11
  const [week, setWeek] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null); // YYYY-MM-DD
  const [yearBase, setYearBase] = useState(now.getFullYear());

  const weekdayLabels = locale === "en"
    ? ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"]
    : ["س", "ح", "ن", "ث", "ر", "خ", "ج"];

  const weeks = useMemo(
    () => (year !== null && month0 !== null ? monthWeeks(year, month0) : []),
    [year, month0]
  );

  // Derive range + label from the current selection and notify the parent.
  useEffect(() => {
    if (year === null) {
      onChange(null, t("allMonths"));
      return;
    }
    if (month0 === null) {
      onChange({ from: `${year}-01-01`, to: `${year}-12-31` }, String(year));
      return;
    }
    const monthName = months[month0];
    if (day) {
      const d = new Date(day + "T00:00:00");
      onChange({ from: day, to: day }, `${year} › ${monthName} › ${d.getDate()}`);
      return;
    }
    if (week !== null && weeks[week]) {
      const row = weeks[week];
      const from = ymd(row[0].date);
      const to = ymd(row[6].date);
      onChange({ from, to }, `${year} › ${monthName} › ${t("weekLabel")} ${week + 1}`);
      return;
    }
    const last = new Date(year, month0 + 1, 0);
    onChange({ from: `${year}-${pad(month0 + 1)}-01`, to: ymd(last) }, `${monthName} ${year}`);
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
        <button onClick={() => { reset("all"); }}
          className={cn(chip(year === null), "px-3 py-1.5 shrink-0")}>
          {t("allMonths")}
        </button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 shrink-0" />
        <button onClick={() => setYearBase((y) => y - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0" aria-label="prev years">
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
        <button onClick={() => setYearBase((y) => y + 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0" aria-label="next years">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Months */}
      {year !== null && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-1.5">
          <button onClick={() => reset("year")}
            className={cn(chip(month0 === null), "px-3 py-1.5")}>
            {t("wholeYear")}
          </button>
          {months.map((m, i) => (
            <button key={i} onClick={() => { setMonth0(i); reset("month"); }}
              className={cn(chip(month0 === i), "px-3 py-1.5 min-w-[68px]")}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Weeks + Days (mini calendar) */}
      {year !== null && month0 !== null && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={() => reset("month")}
            className={cn(chip(week === null && !day), "px-3 py-1.5 mb-2")}>
            {t("wholeMonth")}
          </button>
          <div className="overflow-x-auto">
            <table className="w-full text-center select-none">
              <thead>
                <tr className="text-[11px] text-gray-400">
                  <th className="w-10"></th>
                  {weekdayLabels.map((w, i) => <th key={i} className="py-1 font-semibold">{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {weeks.map((row, wi) => {
                  const weekActive = week === wi && !day;
                  return (
                    <tr key={wi}>
                      <td className="pe-1">
                        <button onClick={() => { setWeek(wi); setDay(null); }}
                          className={cn(chip(weekActive), "w-9 h-8 text-[11px] font-bold")}
                          title={`${t("weekLabel")} ${wi + 1}`}>
                          {t("weekShort")}{wi + 1}
                        </button>
                      </td>
                      {row.map(({ date, inMonth }, di) => {
                        const key = ymd(date);
                        const isToday = key === ymd(now);
                        const active = day === key;
                        return (
                          <td key={di} className="p-0.5">
                            <button onClick={() => { setDay(active ? null : key); if (!active) setWeek(null); }}
                              className={cn(
                                "w-9 h-8 rounded-lg text-xs font-bold border transition-all",
                                active
                                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                                  : inMonth
                                    ? "bg-white dark:bg-gray-800 border-transparent hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200"
                                    : "bg-transparent border-transparent text-gray-300 dark:text-gray-600",
                                isToday && !active && "ring-1 ring-blue-400"
                              )}>
                              {date.getDate()}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
