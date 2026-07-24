"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { STATUS_MAP } from "@/lib/types";
import { Search, FilePlus, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { EmptyState } from "@/components/empty-state";

const STATUS_KEYS: Record<string, TranslationKey> = {
  all: "statusAll",
  draft: "statusDraft",
  pending: "statusPending",
  approved: "statusApproved",
  sent: "statusSent",
  accepted: "statusAccepted",
  revised: "statusRevised",
  declined: "statusDeclined",
  cancelled: "statusCancelled",
};

interface Quotation {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  createdAt: string;
  customer: { name: string; phone: string; governorate: string };
  employee: { name: string };
  _count: { items: number };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const limit = 20;
  const debouncedSearch = useDebouncedValue(search);
  const { t, dateLocale } = useI18n();

  const fmtCur = (n: number) => `${n.toFixed(3)} ${t("omr")}`;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/quotations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setQuotations(data.quotations || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, page]);

  const statuses = ["all", ...Object.keys(STATUS_MAP)];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("quotationsList")}</h1>
          <p className="text-sm text-gray-500 mt-1">{total} {t("quotationCount")}</p>
        </div>
        <Link href="/quotations/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 transition-colors">
          <FilePlus className="w-4 h-4" />
          {t("newQuotation")}
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded pr-10 pl-3 py-2.5 text-sm"
              placeholder={t("searchQuotations")} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-colors border",
                  statusFilter === s
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-400")}>
                {STATUS_KEYS[s] ? t(STATUS_KEYS[s]) : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm font-mono-en flex-1" />
            <span className="text-xs text-gray-400">{t("to")}</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm font-mono-en flex-1" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-red-500 font-bold hover:text-red-700">{t("clear")}</button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">{t("loading")}</div>
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("noResults")}
            actionLabel={t("newQuotation")}
            actionHref="/quotations/new"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">{t("quoteNumber")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("customer")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("region")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("items")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("status")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("total")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => {
                  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
                  const statusKey = STATUS_KEYS[q.status];
                  return (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 px-5">
                        <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold">{q.customer.name}</p>
                        <p className="text-xs text-gray-400 font-mono-en">{q.customer.phone}</p>
                      </td>
                      <td className="p-3 text-gray-500">{q.customer.governorate}</td>
                      <td className="p-3 font-mono-en text-gray-500">{q._count.items}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                          {statusKey ? t(statusKey) : status.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono-en font-bold">{fmtCur(q.total)}</td>
                      <td className="p-3 text-gray-400 font-mono-en text-xs">
                        {new Date(q.createdAt).toLocaleDateString(dateLocale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {t("showing")} {(page - 1) * limit + 1} - {Math.min(page * limit, total)} {t("of")} {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t("previous")}
            </button>
            <span className="flex items-center px-3 text-sm text-gray-500 font-mono-en">
              {page} / {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
              disabled={page >= Math.ceil(total / limit)}
              className="px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
