"use client";

import Link from "next/link";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import { FileText, FilePlus, Users, TrendingUp, Clock, ArrowUpRight, AlertTriangle } from "lucide-react";

interface DashboardData {
  userName: string;
  isAdmin: boolean;
  totalQuotes: number;
  totalCustomers: number;
  monthlyQuotes: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  declinedCount: number;
  revisedCount: number;
  totalRevenue: number;
  conversionRate: string;
  expiringQuotations: Array<{
    id: string;
    quoteNumber: string;
    customerName: string;
    daysLeft: number;
  }>;
  quotations: Array<{
    id: string;
    quoteNumber: string;
    customerName: string;
    employeeName: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    itemCount: number;
    total: number;
    createdAt: string;
  }>;
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const { t, locale, dateLocale } = useI18n();

  const stats = [
    { labelKey: "totalQuotations" as TranslationKey, value: data.totalQuotes, sub: `${data.monthlyQuotes} ${t("thisMonth")}`, icon: FileText, color: "bg-blue-50 text-blue-600" },
    { labelKey: "customers" as TranslationKey, value: data.totalCustomers, sub: null, icon: Users, color: "bg-green-50 text-green-600" },
    { labelKey: "approvedRevenue" as TranslationKey, value: formatCurrency(data.totalRevenue), sub: `${data.conversionRate}% ${t("conversionRate")}`, icon: TrendingUp, color: "bg-purple-50 text-purple-600" },
    { labelKey: "underReview" as TranslationKey, value: data.pendingCount, sub: `${data.draftCount} ${t("draft")}`, icon: Clock, color: "bg-yellow-50 text-yellow-600" },
  ];

  const statusCards = [
    { labelKey: "draft" as TranslationKey, count: data.draftCount, color: "border-gray-300 text-gray-600 bg-gray-50" },
    { labelKey: "underReview" as TranslationKey, count: data.pendingCount, color: "border-blue-300 text-blue-600 bg-blue-50" },
    { labelKey: "approved" as TranslationKey, count: data.approvedCount, color: "border-green-300 text-green-600 bg-green-50" },
    { labelKey: "revised" as TranslationKey, count: data.revisedCount, color: "border-orange-300 text-orange-600 bg-orange-50" },
    { labelKey: "declined" as TranslationKey, count: data.declinedCount, color: "border-red-300 text-red-600 bg-red-50" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("welcome")}{locale === "ar" ? "،" : ","} {data.userName}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("activitySummary")}</p>
        </div>
        <Link
          href="/quotations/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          {t("newQuotation")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.labelKey} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">{t(stat.labelKey)}</p>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
            {stat.sub && <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {statusCards.map((s) => (
          <div key={s.labelKey} className={`border rounded p-3 text-center ${s.color}`}>
            <p className="text-2xl font-black font-mono-en">{s.count}</p>
            <p className="text-xs font-bold mt-0.5">{t(s.labelKey)}</p>
          </div>
        ))}
      </div>

      {data.expiringQuotations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">{t("expiringQuotations")}</h2>
          </div>
          <div className="space-y-2">
            {data.expiringQuotations.map((q) => (
              <div key={q.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-3 border border-amber-100 dark:border-amber-800">
                <div className="flex items-center gap-3">
                  <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 dark:text-white hover:underline text-sm">
                    {q.quoteNumber}
                  </Link>
                  <span className="text-sm text-gray-600">{q.customerName}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${q.daysLeft <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {q.daysLeft <= 0 ? t("expired") : `${q.daysLeft} ${t("daysRemaining")}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold">{t("recentQuotations")}</h2>
          <Link href="/quotations" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white font-semibold">
            {t("viewAll")}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data.quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">{t("noQuotationsYet")}</p>
            <Link href="/quotations/new" className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-gray-900 hover:underline">
              <FilePlus className="w-4 h-4" />
              {t("createFirstQuotation")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("quoteNumber")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("customer")}</th>
                  {data.isAdmin && <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("employee")}</th>}
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("status")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("items")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("total")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.quotations.map((q) => (
                  <tr key={q.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="p-3 px-5">
                      <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 dark:text-white hover:underline">
                        {q.quoteNumber}
                      </Link>
                    </td>
                    <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">{q.customerName}</td>
                    {data.isAdmin && <td className="p-3 text-gray-500 text-xs">{q.employeeName}</td>}
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${q.statusColor}`}>
                        {q.statusLabel}
                      </span>
                    </td>
                    <td className="p-3 font-mono-en text-gray-400 text-xs">{q.itemCount}</td>
                    <td className="p-3 font-mono-en font-bold text-gray-900 dark:text-white">{formatCurrency(q.total)}</td>
                    <td className="p-3 text-gray-400 font-mono-en text-xs">
                      {new Date(q.createdAt).toLocaleDateString(dateLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
