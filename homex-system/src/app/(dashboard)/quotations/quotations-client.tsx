"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { STATUS_MAP } from "@/lib/types";
import { Search, FilePlus, FileText, Trash2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeleton";
import { DateDrillNav } from "@/components/date-drill-nav";

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

export function QuotationsClient({ initialData }: { initialData: { quotations: Quotation[]; total: number } }) {
  const [quotations, setQuotations] = useState<Quotation[]>(initialData.quotations);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // "recent" = newest first (default) · "delivery" = nearest delivery first.
  const [sort, setSort] = useState<"recent" | "delivery">("recent");
  const limit = 20;
  const debouncedSearch = useDebouncedValue(search);
  const { t, dateLocale } = useI18n();
  const toast = useToast();
  // The first page is already server-rendered; skip the initial client refetch.
  const firstRun = useRef(true);

  // Multi-select delete (managers only) — off until "Select" is pressed, so
  // checkboxes can't be ticked (and mass-deleted) by accident.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [canDelete, setCanDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (m) setCanDelete(m.role === "admin" || m.role === "ceo" || m.role === "manager" || (m.permissions || []).includes("trash"));
    }).catch(() => {});
  }, []);

  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allOnPageSelected = quotations.length > 0 && quotations.every((q) => selected.has(q.id));
  const toggleAllOnPage = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allOnPageSelected) quotations.forEach((q) => next.delete(q.id));
    else quotations.forEach((q) => next.add(q.id));
    return next;
  });

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`سيتم نقل ${ids.length} عرض إلى المحذوفات.\nهل أنت متأكد؟ (يمكن استرجاعها لاحقاً من صفحة المحذوفات)`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/quotations/bulk-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل الحذف"); return; }
      toast.success(`تم نقل ${data.deleted} عرض إلى المحذوفات`);
      setQuotations((prev) => prev.filter((q) => !selected.has(q.id)));
      setTotal((tot) => Math.max(0, tot - data.deleted));
      exitSelectMode();
    } catch {
      toast.error("تعذّر الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const fmtCur = (n: number) => `${n.toFixed(3)} ${t("omr")}`;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (sort !== "recent") params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/quotations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setQuotations(data.quotations || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, sort, page]);

  const statuses = ["all", ...Object.keys(STATUS_MAP)];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("quotationsList")}</h1>
          <p className="text-sm text-gray-500 mt-1">{total} {t("quotationCount")}</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            selectMode ? (
              <button onClick={exitSelectMode}
                className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" /> إلغاء التحديد
              </button>
            ) : (
              <button onClick={() => setSelectMode(true)}
                className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <Trash2 className="w-4 h-4" /> تحديد للحذف
              </button>
            )
          )}
          <Link href="/quotations/new"
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 transition-colors">
            <FilePlus className="w-4 h-4" />
            {t("newQuotation")}
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="field pr-10 pl-3"
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
      </div>

      {/* Year → month → week/day filter (same as the work board), driving the
          created-date range so it's easy to find & clean up a period. */}
      <DateDrillNav onChange={(range) => { setDateFrom(range?.from || ""); setDateTo(range?.to || ""); }} />

      {/* Sort toggle: newest created (default) vs nearest delivery first. */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-gray-400 font-semibold">الترتيب:</span>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button type="button" onClick={() => { setSort("recent"); setPage(1); }}
            className={cn("px-3 py-1.5 font-semibold transition-colors", sort === "recent" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50")}>
            الأحدث
          </button>
          <button type="button" onClick={() => { setSort("delivery"); setPage(1); }}
            className={cn("px-3 py-1.5 font-semibold transition-colors border-r border-gray-200 dark:border-gray-700", sort === "delivery" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50")}>
            الأقرب تسليماً
          </button>
        </div>
      </div>

      {canDelete && selectMode && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <span className="text-sm font-bold text-red-700 dark:text-red-300">تم تحديد <span className="font-mono-en">{selected.size}</span> عرض</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700">
              <X className="w-3.5 h-3.5" /> إلغاء التحديد
            </button>
            <button onClick={bulkDelete} disabled={deleting}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} حذف المحدد
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
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
                  {canDelete && selectMode && (
                    <th className="p-3 pr-5 w-8">
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage}
                        className="w-4 h-4 accent-red-600 align-middle" title="تحديد كل الصفحة" />
                    </th>
                  )}
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
                    <tr key={q.id} className={cn("border-b border-gray-50 hover:bg-gray-50/50 transition-colors", selectMode && selected.has(q.id) && "bg-red-50/50 dark:bg-red-900/10")}>
                      {canDelete && selectMode && (
                        <td className="p-3 pr-5 w-8">
                          <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)}
                            className="w-4 h-4 accent-red-600 align-middle" />
                        </td>
                      )}
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
