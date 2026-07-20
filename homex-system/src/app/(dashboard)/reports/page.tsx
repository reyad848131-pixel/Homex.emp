"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, MapPin, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_MAP } from "@/lib/types";

function BarChartSVG({ data, height = 200 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات</p>;
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

function DonutChart({ segments, size = 160 }: { segments: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات</p>;
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
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-400 text-[9px]">إجمالي</text>
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
  employeeStats: Array<{ name: string; count: number; total: number; approved: number }>;
  categoryCounts: Array<{ name: string; count: number; total: number }>;
  governorateCounts: Array<{ name: string; count: number }>;
  dailyData: Array<{ date: string; count: number; total: number }>;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const fmtCur = (n: number | string) => `${Number(n).toFixed(3)} ر.ع`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="text-center py-20 text-gray-400">جاري التحميل...</div>;
  if (!data) return <div className="text-center py-20 text-red-500">خطأ في تحميل التقارير</div>;

  const maxCatTotal = Math.max(...data.categoryCounts.map((c) => c.total), 1);
  const maxGov = Math.max(...data.governorateCounts.map((g) => g.count), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          التقارير
        </h1>
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          {[
            { key: "week", label: "أسبوع" },
            { key: "month", label: "شهر" },
            { key: "year", label: "سنة" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-bold transition-colors",
                period === p.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "إجمالي العروض", value: data.summary.totalQuotations, icon: FileText, color: "text-blue-600" },
          { label: "إجمالي الإيرادات", value: fmtCur(data.summary.totalRevenue), icon: TrendingUp, color: "text-green-600" },
          { label: "المعتمد", value: fmtCur(data.summary.totalApproved), icon: TrendingUp, color: "text-emerald-600" },
          { label: "نسبة التحويل", value: `${data.summary.conversionRate}%`, icon: BarChart3, color: "text-purple-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn("w-4 h-4", card.color)} />
              <span className="text-xs text-gray-400 font-bold">{card.label}</span>
            </div>
            <p className="text-xl font-black font-mono-en">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Donut */}
        <div className="bg-white border border-gray-200 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">توزيع الحالات</h2>
          <DonutChart segments={[
            { label: "مسودة", value: data.summary.statusCounts.draft || 0, color: "#6b7280" },
            { label: "قيد المراجعة", value: data.summary.statusCounts.pending || 0, color: "#3b82f6" },
            { label: "معتمد", value: data.summary.statusCounts.approved || 0, color: "#16a34a" },
            { label: "مرفوض", value: data.summary.statusCounts.declined || 0, color: "#dc2626" },
          ]} />
        </div>

        {/* Daily Activity */}
        <div className="bg-white border border-gray-200 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> النشاط اليومي (عدد العروض)
          </h2>
          <BarChartSVG data={data.dailyData.map((d) => ({
            label: d.date.slice(5),
            value: d.count,
          }))} />
        </div>
      </div>

      {/* Daily Revenue Chart */}
      <div className="bg-white border border-gray-200 rounded p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> الإيرادات اليومية (ر.ع)
        </h2>
        <BarChartSVG data={data.dailyData.map((d) => ({
          label: d.date.slice(5),
          value: Math.round(d.total),
        }))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Employee Performance */}
        <div className="bg-white border border-gray-200 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> أداء الموظفين
          </h2>
          <div className="space-y-3">
            {data.employeeStats.map((emp) => (
              <div key={emp.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {emp.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold truncate">{emp.name}</p>
                    <p className="text-sm font-mono-en font-bold">{fmtCur(emp.total)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span>{emp.count} عرض</span>
                    <span>{emp.approved} معتمد</span>
                    <span className="font-mono-en">{emp.count > 0 ? ((emp.approved / emp.count) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>
              </div>
            ))}
            {data.employeeStats.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white border border-gray-200 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">الفئات الأكثر طلبا</h2>
          <div className="space-y-3">
            {data.categoryCounts.slice(0, 8).map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{cat.name}</span>
                  <span className="text-xs text-gray-400 font-mono-en">{cat.count} بند - {fmtCur(cat.total)}</span>
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
              <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>
      </div>

      {/* Governorate Distribution */}
      <div className="bg-white border border-gray-200 rounded p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> توزيع المحافظات
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
            <p className="text-sm text-gray-400 text-center py-4 col-span-full">لا توجد بيانات</p>
          )}
        </div>
      </div>
    </div>
  );
}
