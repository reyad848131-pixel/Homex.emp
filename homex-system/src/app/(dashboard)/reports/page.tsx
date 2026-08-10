"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, MapPin, FileText, Calendar, Printer, Truck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_MAP } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { WorkerProductivity } from "./worker-productivity";

function BarChartSVG({ data, height = 200, noDataText }: { data: Array<{ label: string; value: number }>; height?: number; noDataText: string }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">{noDataText}</p>;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(12, Math.min(40, (600 / data.length) - 4));
  const chartWidth = data.length * (barWidth + 4);

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(chartWidth, 300)} height={height + 30} className="mx-auto">
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * height;
          const x = i * (barWidth + 4) + 2;
          return (
            <g key={i}>
              <rect x={x} y={height - barH} width={barWidth} height={barH} rx={3} fill="#111827" opacity={0.85} />
              {d.value > 0 && (
                <text x={x + barWidth / 2} y={height - barH - 4} textAnchor="middle"
                  className="fill-gray-500 text-[9px] font-mono-en">{d.value}</text>
              )}
              <text x={x + barWidth / 2} y={height + 14} textAnchor="middle"
                className="fill-gray-400 text-[8px] font-mono-en">{d.label}</text>
            </g>
          );
        })}
        <line x1={0} y1={height} x2={chartWidth} y2={height} stroke="#e5e7eb" strokeWidth={1} />
      </svg>
    </div>
  );
}

function DonutChart({ segments, size = 160, totalLabel }: { segments: Array<{ label: string; value: number; color: string }>; size?: number; totalLabel: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-8">{totalLabel}</p>;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let cumAngle = -Math.PI / 2;

  return (
    <div className="flex items-center gap-6 justify-center">
      <svg width={size} height={size}>
        {segments.filter((s) => s.value > 0).map((seg, i) => {
          const angle = (seg.value / total) * 2 * Math.PI;
          const x1 = cx + r * Math.cos(cumAngle);
          const y1 = cy + r * Math.sin(cumAngle);
          cumAngle += angle;
          const x2 = cx + r * Math.cos(cumAngle);
          const y2 = cy + r * Math.sin(cumAngle);
          const large = angle > Math.PI ? 1 : 0;
          if (segments.filter((s) => s.value > 0).length === 1) {
            return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={24} />;
          }
          return (
            <path key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={seg.color} opacity={0.85} />
          );
        })}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900 text-lg font-black">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-400 text-[9px]">{totalLabel}</text>
      </svg>
      <div className="space-y-2">
        {segments.filter((s) => s.value > 0).map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-600">{seg.label}</span>
            <span className="font-bold font-mono-en">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReportData {
  summary: {
    totalQuotations: number;
    totalRevenue: string;
    totalApproved: string;
    conversionRate: string;
    statusCounts: Record<string, number>;
  };
  operations?: {
    deliveredCount: number;
    onTimeRate: string | null;
    avgDaysToDeliver: string | null;
  };
  employeeStats: Array<{ name: string; count: number; total: number; approved: number }>;
  categoryCounts: Array<{ name: string; count: number; total: number }>;
  governorateCounts: Array<{ name: string; count: number }>;
  dailyData: Array<{ date: string; count: number; total: number }>;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  // Curtain-below-minimum audit (on-demand).
  const [audit, setAudit] = useState<{ count: number; scanned: number; violations: Array<{ id: string; quoteNumber: string; customerName: string; wilayat: string; count: number; min: number }> } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const { t, locale } = useI18n();

  const runCurtainAudit = () => {
    setAuditLoading(true);
    fetch("/api/quotations/curtain-audit")
      .then((r) => (r.ok ? r.json() : { count: 0, violations: [] }))
      .then(setAudit)
      .finally(() => setAuditLoading(false));
  };

  const fmtCur = (n: number | string) => `${Number(n).toFixed(3)} ${t("omr")}`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="text-center py-20 text-gray-400">{t("loading")}</div>;
  if (!data) return <div className="text-center py-20 text-red-500">{t("reportError")}</div>;

  const maxCatTotal = Math.max(...data.categoryCounts.map((c) => c.total), 1);
  const maxGov = Math.max(...data.governorateCounts.map((g) => g.count), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          {t("reportsTitle")}
        </h1>
        <div className="flex items-center gap-2 no-print">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
            {([
              { key: "week", tKey: "weekPeriod" as const },
              { key: "month", tKey: "monthPeriod" as const },
              { key: "year", tKey: "yearPeriod" as const },
            ]).map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-bold transition-colors",
                  period === p.key ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                {t(p.tKey)}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            {t("print")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("totalQuotations"), value: data.summary.totalQuotations, icon: FileText, color: "text-blue-600" },
          { label: t("totalRevenue"), value: fmtCur(data.summary.totalRevenue), icon: TrendingUp, color: "text-green-600" },
          { label: t("approvedAmount"), value: fmtCur(data.summary.totalApproved), icon: TrendingUp, color: "text-emerald-600" },
          { label: t("conversionRate"), value: `${data.summary.conversionRate}%`, icon: BarChart3, color: "text-purple-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn("w-4 h-4", card.color)} />
              <span className="text-xs text-gray-400 font-bold">{card.label}</span>
            </div>
            <p className="text-xl font-black font-mono-en">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Operational KPIs (delivery performance) */}
      {data.operations && data.operations.deliveredCount > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: t("rpDelivered"), value: String(data.operations.deliveredCount), icon: Truck, color: "text-teal-600" },
            { label: t("rpOnTime"), value: data.operations.onTimeRate != null ? `${data.operations.onTimeRate}%` : "—", icon: Clock, color: "text-emerald-600" },
            { label: t("rpAvgLead"), value: data.operations.avgDaysToDeliver != null ? `${data.operations.avgDaysToDeliver} ${t("rpDaysUnit")}` : "—", icon: Calendar, color: "text-indigo-600" },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={cn("w-4 h-4", card.color)} />
                <span className="text-xs text-gray-400 font-bold">{card.label}</span>
              </div>
              <p className="text-xl font-black font-mono-en">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Worker productivity — factory-floor output per worker. */}
      <WorkerProductivity />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t("statusDistribution")}</h2>
          <DonutChart totalLabel={t("totalCount")} segments={[
            { label: t("draftStatus"), value: data.summary.statusCounts.draft || 0, color: "#6b7280" },
            { label: t("pendingReview"), value: data.summary.statusCounts.pending || 0, color: "#3b82f6" },
            { label: t("approved"), value: data.summary.statusCounts.approved || 0, color: "#16a34a" },
            { label: t("returnedForEdit"), value: data.summary.statusCounts.revised || 0, color: "#f97316" },
            { label: t("declinedStatus"), value: data.summary.statusCounts.declined || 0, color: "#dc2626" },
          ]} />
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> {t("dailyActivity")}
          </h2>
          <BarChartSVG noDataText={t("noData")} data={data.dailyData.map((d) => ({
            label: d.date.slice(5),
            value: d.count,
          }))} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> {t("dailyRevenue")} ({t("omr")})
        </h2>
        <BarChartSVG noDataText={t("noData")} data={data.dailyData.map((d) => ({
          label: d.date.slice(5),
          value: Math.round(d.total),
        }))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> {t("employeePerformance")}
          </h2>
          <div className="space-y-4">
            {data.employeeStats.map((emp) => {
              const convRate = emp.count > 0 ? ((emp.approved / emp.count) * 100) : 0;
              const maxEmpTotal = Math.max(...data.employeeStats.map(e => e.total), 1);
              return (
                <div key={emp.name} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.count} {t("quoteWord")} · {emp.approved} {t("approvedWord")}</p>
                    </div>
                    <p className="text-sm font-mono-en font-black text-green-600">{fmtCur(emp.total)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>{t("revenueLabel")}</span>
                        <span className="font-mono-en">{((emp.total / maxEmpTotal) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${(emp.total / maxEmpTotal) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>{t("conversionRate")}</span>
                        <span className="font-mono-en">{convRate.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", convRate >= 50 ? "bg-green-500" : convRate >= 25 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${convRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {data.employeeStats.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t("noData")}</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t("topCategories")}</h2>
          <div className="space-y-3">
            {data.categoryCounts.slice(0, 8).map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{cat.name}</span>
                  <span className="text-xs text-gray-400 font-mono-en">{cat.count} {t("itemWord")} - {fmtCur(cat.total)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all"
                    style={{ width: `${(cat.total / maxCatTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {data.categoryCounts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t("noData")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> {t("governorateDistribution")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.governorateCounts.map((gov) => (
            <div key={gov.name} className="border border-gray-100 rounded p-3 text-center">
              <p className="text-lg font-black font-mono-en">{gov.count}</p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">{gov.name}</p>
              <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(gov.count / maxGov) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {data.governorateCounts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4 col-span-full">{t("noData")}</p>
          )}
        </div>
      </div>

      {/* Curtain-below-minimum audit */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5 mt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t("rpCurtainTitle")}</h2>
            <p className="text-xs text-gray-400 mt-1">{t("rpCurtainSub")}</p>
          </div>
          <button onClick={runCurtainAudit} disabled={auditLoading}
            className="shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50">
            {auditLoading ? t("rpChecking") : t("rpCheckNow")}
          </button>
        </div>
        {audit && (
          <div className="mt-4">
            {audit.count === 0 ? (
              <p className="text-sm font-semibold text-emerald-600">✓ {t("rpNoViolations")} ({locale === "en" ? <><span className="font-mono-en">{audit.scanned}</span> {t("rpCurtainOrdersUnit")} {t("rpChecked")}</> : <>{t("rpChecked")} <span className="font-mono-en">{audit.scanned}</span> {t("rpCurtainOrdersUnit")}</>}).</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3"><span className="font-mono-en">{audit.count}</span> {t("rpViolationsFound")}:</p>
                <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-500 text-xs">
                      <tr><th className="p-2 text-right">{t("rpColOrder")}</th><th className="p-2 text-right">{t("rpColCustomer")}</th><th className="p-2 text-right">{t("rpColWilayat")}</th><th className="p-2 text-right">{t("rpColCount")}</th><th className="p-2 text-right">{t("rpColMin")}</th><th className="p-2"></th></tr>
                    </thead>
                    <tbody>
                      {audit.violations.map((v) => (
                        <tr key={v.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-mono-en font-bold">{v.quoteNumber}</td>
                          <td className="p-2">{displayName(v.customerName, locale)}</td>
                          <td className="p-2 text-gray-500">{v.wilayat}</td>
                          <td className="p-2 font-mono-en text-red-600 font-bold">{v.count}</td>
                          <td className="p-2 font-mono-en text-gray-500">{v.min}</td>
                          <td className="p-2"><a href={`/quotations/${v.id}/edit`} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">{t("rpOpenFix")}</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
