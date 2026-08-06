"use client";

import { useState, useEffect, useMemo } from "react";
import { HardHat, Trophy, CheckCircle2, Clock, Users } from "lucide-react";
import { initials } from "@/lib/workers";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Row {
  id: string; name: string; color: string; isActive: boolean;
  completed: number; onTimeRate: number | null; currentLoad: number; lastDone: string | null;
}
interface Data {
  range: { from: string; to: string };
  totals: { totalCompleted: number; activeWorkers: number; onTimeRate: number | null };
  star: Row | null;
  rows: Row[];
}

const pad = (n: number) => String(n).padStart(2, "0");
function ranges() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const ym = (yy: number, mm: number, d: number) => `${yy}-${pad(mm + 1)}-${pad(d)}`;
  const lastMonth = new Date(y, m - 1, 1);
  return {
    month: { from: ym(y, m, 1), to: ym(y, m, new Date(y, m + 1, 0).getDate()) },
    last: { from: ym(lastMonth.getFullYear(), lastMonth.getMonth(), 1), to: ym(lastMonth.getFullYear(), lastMonth.getMonth(), new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()) },
    year: { from: `${y}-01-01`, to: `${y}-12-31` },
  };
}

function Avatar({ color, name, size = 34 }: { color: string; name: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-lg font-black shrink-0"
      style={{ width: size, height: size, background: color, color: "#0c0c0e", fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

function timeAgo(iso: string | null, en: boolean): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return en ? "just now" : "قبل قليل";
  if (h < 24) return en ? `${h}h ago` : `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  return en ? `${d}d ago` : `قبل ${d} يوم`;
}

export function WorkerProductivity() {
  const { t, locale } = useI18n();
  const en = locale === "en";
  const periodLabel: Record<"month" | "last" | "year", string> = {
    month: t("wpThisMonth"), last: t("wpLastMonth"), year: t("wpThisYear"),
  };
  const R = useMemo(() => ranges(), []);
  const [period, setPeriod] = useState<"month" | "last" | "year">("month");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const r = R[period];
    fetch(`/api/reports/workers?from=${r.from}&to=${r.to}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, R]);

  const maxDone = Math.max(1, ...(data?.rows.map((r) => r.completed) || [1]));
  const hasAny = data && data.rows.some((r) => r.completed > 0 || r.currentLoad > 0);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <HardHat className="w-4 h-4" /> {t("workerProductivity")}
        </h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1">
          {(["month", "last", "year"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-colors",
                period === p ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200")}>
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">{t("loadingDots")}</div>
      ) : !hasAny ? (
        <div className="text-center py-12 text-gray-400">
          <HardHat className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold">{t("wpEmpty")}</p>
          <p className="text-xs mt-1">{t("wpEmptyHint")}</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <div className="text-[11px] text-gray-500 font-bold flex items-center gap-1 mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t("wpStagesDone")}</div>
              <div className="text-2xl font-black font-mono-en">{data!.totals.totalCompleted}</div>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <div className="text-[11px] text-gray-500 font-bold flex items-center gap-1 mb-1"><Users className="w-3.5 h-3.5" /> {t("wpActiveWorkers")}</div>
              <div className="text-2xl font-black font-mono-en">{data!.totals.activeWorkers}</div>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <div className="text-[11px] text-gray-500 font-bold flex items-center gap-1 mb-1"><Clock className="w-3.5 h-3.5" /> {t("wpOnTime")}</div>
              <div className="text-2xl font-black font-mono-en">{data!.totals.onTimeRate != null ? `${data!.totals.onTimeRate}%` : "—"}</div>
            </div>
          </div>

          {/* Star of the period */}
          {data!.star && data!.star.completed > 0 && (
            <div className="flex items-center gap-3 p-3.5 mb-5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-l from-amber-50 to-transparent dark:from-amber-900/15">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-amber-100 dark:bg-amber-900/30 shrink-0"><Trophy className="w-5 h-5 text-amber-500" /></div>
              <div className="min-w-0">
                <div className="font-black flex items-center gap-2"><Avatar color={data!.star.color} name={data!.star.name} size={24} /> {data!.star.name} — {t("wpStar")}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono-en font-bold">{data!.star.completed}</span> {t("prodStagesDone")}
                  {data!.star.onTimeRate != null && <> · <span className="font-mono-en font-bold">{data!.star.onTimeRate}%</span> {t("wpOnTime")}</>}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] text-gray-400 font-bold">
                  <th className="text-start pb-2 pe-2">#</th>
                  <th className="text-start pb-2">{t("wpColWorker")}</th>
                  <th className="text-start pb-2 min-w-[140px]">{t("wpColOutput")}</th>
                  <th className="text-start pb-2">{t("wpColOnTime")}</th>
                  <th className="text-start pb-2">{t("wpColLoad")}</th>
                  <th className="text-start pb-2">{t("wpColLast")}</th>
                </tr>
              </thead>
              <tbody>
                {data!.rows.filter((r) => r.completed > 0 || r.currentLoad > 0).map((r, i) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2.5 pe-2 font-mono-en text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2.5"><div className="flex items-center gap-2 font-bold"><Avatar color={r.color} name={r.name} size={28} /> {r.name}{!r.isActive && <span className="text-[10px] text-gray-400 font-normal">({t("wkInactive")})</span>}</div></td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded bg-gray-100 dark:bg-gray-700 flex-1 min-w-[50px] overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${(r.completed / maxDone) * 100}%`, background: r.color }} />
                        </div>
                        <span className="font-mono-en font-bold w-7 text-end">{r.completed}</span>
                      </div>
                    </td>
                    <td className="py-2.5 font-mono-en font-bold" style={{ color: r.onTimeRate == null ? "#9ca3af" : r.onTimeRate >= 80 ? "#059669" : r.onTimeRate >= 60 ? "#d97706" : "#dc2626" }}>
                      {r.onTimeRate != null ? `${r.onTimeRate}%` : "—"}
                    </td>
                    <td className="py-2.5"><span className="font-mono-en text-gray-500">{r.currentLoad || "—"}</span></td>
                    <td className="py-2.5 text-gray-500 text-xs">{timeAgo(r.lastDone, en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
