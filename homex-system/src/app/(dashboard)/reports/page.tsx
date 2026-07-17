"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, MapPin, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_MAP } from "@/lib/types";

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

      {/* Status Distribution */}
      <div className="bg-white border border-gray-200 rounded p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">توزيع الحالات</h2>
        <div className="flex gap-3">
          {Object.entries(data.summary.statusCounts).map(([key, count]) => {
            const s = STATUS_MAP[key] || STATUS_MAP.draft;
            const pct = data!.summary.totalQuotations > 0 ? ((count / data!.summary.totalQuotations) * 100).toFixed(0) : 0;
            return (
              <div key={key} className="flex-1 text-center">
                <div className={`text-2xl font-black font-mono-en ${s.color.includes("green") ? "text-green-600" : s.color.includes("red") ? "text-red-600" : s.color.includes("blue") ? "text-blue-600" : "text-gray-600"}`}>
                  {count}
                </div>
                <div className="text-xs text-gray-500 font-bold mt-1">{s.label}</div>
                <div className="text-[10px] text-gray-400 font-mono-en">{pct}%</div>
              </div>
            );
          })}
        </div>
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
