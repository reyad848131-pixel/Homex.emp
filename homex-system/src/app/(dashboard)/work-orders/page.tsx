"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { WORK_STATUS_MAP } from "@/lib/types";
import { useDebouncedValue } from "@/lib/hooks";
import { useI18n, useTranslatedMonths, type TranslationKey } from "@/lib/i18n";
import { TableSkeleton, CardsSkeleton } from "@/components/skeleton";
import { DateDrillNav, type DateRange } from "@/components/date-drill-nav";
import {
  Truck,
  Search,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  X,
  Check,
  Filter,
  Package,
} from "lucide-react";

interface WorkQuotation {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  notes: string | null;
  deliveryDate: string;
  workStatus: string | null;
  hasOrangeAlert: boolean;
  hasRedAlert: boolean;
  workNotes: string | null;
  woodStatus: string;
  fabricStatus: string;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string };
  employee: { name: string };
  items: Array<{ description: string; quantity: number; category: { nameAr: string; nameEn: string } }>;
}

const MATERIAL_STATUS_KEYS: Record<string, { labelKey: TranslationKey; color: string }> = {
  not_ordered: { labelKey: "notOrdered", color: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" },
  ordered: { labelKey: "ordered", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  arrived: { labelKey: "arrived", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const WORK_STATUS_KEYS: Record<string, TranslationKey> = {
  needs_preparation: "needsPreparation",
  ready_to_execute: "readyToExecute",
  in_progress: "inProgress",
  completed: "completed",
  delivered: "delivered",
};

function getDaysRemaining(deliveryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  return Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isAutoUrgent(deliveryDate: string, workStatus: string | null): boolean {
  if (workStatus === "delivered") return false;
  return getDaysRemaining(deliveryDate) <= 30;
}

function DaysRemainingBadge({ days, workStatus }: { days: number; workStatus: string | null }) {
  const { t } = useI18n();

  if (workStatus === "delivered") {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{t("deliveredStatus")}</span>;
  }
  if (days < 0) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t("lateBy")} {Math.abs(days)} {t("day")}</span>;
  }
  if (days === 0) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t("today")}</span>;
  }
  if (days <= 7) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{days} {t("day")}</span>;
  }
  if (days <= 30) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{days} {t("day")}</span>;
  }
  return <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{days} {t("day")}</span>;
}

function MaterialBadge({ label, status, onCycle }: { label: string; status: string; onCycle: () => void }) {
  const { t } = useI18n();
  const s = MATERIAL_STATUS_KEYS[status] || MATERIAL_STATUS_KEYS.not_ordered;
  const statusLabel = t(s.labelKey);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition-colors", s.color)}
      title={`${label}: ${statusLabel} — ${t("clickToChange")}`}
    >
      <Package className="w-3 h-3" />
      {label}: {statusLabel}
    </button>
  );
}

function getNextMaterialStatus(current: string): string {
  if (current === "not_ordered") return "ordered";
  if (current === "ordered") return "arrived";
  return "not_ordered";
}

export default function WorkOrdersPage() {
  const [data, setData] = useState<{ quotations: WorkQuotation[]; counts: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { t, locale, dateLocale } = useI18n();
  const [navLabel, setNavLabel] = useState<string>(t("allMonths"));

  // The hierarchical date navigator drives the delivery-date range.
  const handleDateNav = useCallback((range: DateRange | null, label: string) => {
    setDeliveryFrom(range?.from || "");
    setDeliveryTo(range?.to || "");
    setNavLabel(label);
  }, []);

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (activeFilter) params.set("workStatus", activeFilter);
    if (alertFilter === "orange") params.set("hasOrange", "true");
    if (alertFilter === "red") params.set("hasRed", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
    if (deliveryTo) params.set("deliveryTo", deliveryTo);

    fetch(`/api/work-orders?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeFilter, alertFilter, debouncedSearch, deliveryFrom, deliveryTo]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const updateLocal = (id: string, patch: Partial<WorkQuotation>) => {
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.quotations.map((q) => q.id === id ? { ...q, ...patch } : q);
      const counts = { ...prev.counts };
      if (patch.workStatus !== undefined) {
        const old = prev.quotations.find((q) => q.id === id);
        if (old?.workStatus) counts[old.workStatus] = Math.max(0, (counts[old.workStatus] || 0) - 1);
        else counts.no_status = Math.max(0, (counts.no_status || 0) - 1);
        if (patch.workStatus) counts[patch.workStatus] = (counts[patch.workStatus] || 0) + 1;
        else counts.no_status = (counts.no_status || 0) + 1;
      }
      if (patch.hasOrangeAlert !== undefined) {
        const old = prev.quotations.find((q) => q.id === id);
        if (old && old.hasOrangeAlert !== patch.hasOrangeAlert) {
          counts.orange = (counts.orange || 0) + (patch.hasOrangeAlert ? 1 : -1);
        }
      }
      if (patch.hasRedAlert !== undefined) {
        const old = prev.quotations.find((q) => q.id === id);
        if (old && old.hasRedAlert !== patch.hasRedAlert) {
          counts.red = (counts.red || 0) + (patch.hasRedAlert ? 1 : -1);
        }
      }
      return { quotations: updated, counts };
    });
  };

  const patchApi = (body: Record<string, any>) => {
    fetch("/api/work-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => fetchData());
  };

  const handleStatusChange = (id: string, workStatus: string) => {
    const patch: Partial<WorkQuotation> = { workStatus };
    if (workStatus === "delivered") patch.hasRedAlert = false;
    updateLocal(id, patch);
    patchApi({ id, workStatus });
  };

  const handleAlertToggle = (id: string, field: "hasOrangeAlert" | "hasRedAlert", current: boolean) => {
    updateLocal(id, { [field]: !current });
    patchApi({ id, [field]: !current });
  };

  const handleSaveNotes = (id: string) => {
    updateLocal(id, { workNotes: notesText });
    setEditingNotes(null);
    patchApi({ id, workNotes: notesText });
  };

  const handleMaterialCycle = (id: string, field: "woodStatus" | "fabricStatus", current: string) => {
    const next = getNextMaterialStatus(current);
    applyMaterialChange(id, field, next);
  };

  const handleMaterialSet = (id: string, field: "woodStatus" | "fabricStatus", value: string) => {
    applyMaterialChange(id, field, value);
  };

  const applyMaterialChange = (id: string, field: "woodStatus" | "fabricStatus", value: string) => {
    const patch: Partial<WorkQuotation> = { [field]: value };
    const q = data?.quotations.find((q) => q.id === id);
    if (q) {
      const woodFinal = field === "woodStatus" ? value : q.woodStatus;
      const fabricFinal = field === "fabricStatus" ? value : q.fabricStatus;
      if (woodFinal === "arrived" || fabricFinal === "arrived") {
        patch.workStatus = "ready_to_execute";
      } else if (q.workStatus === "ready_to_execute") {
        patch.workStatus = "needs_preparation";
      }
    }
    updateLocal(id, patch);
    patchApi({ id, [field]: value });
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" });

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <CardsSkeleton count={4} />
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
          <TableSkeleton rows={6} />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-red-500">{t("dataError")}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="w-6 h-6" />
          {t("workOrdersTitle")}
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors lg:hidden"
        >
          <Filter className="w-4 h-4" />
          {t("filter")}
        </button>
      </div>

      <DateDrillNav onChange={handleDateNav} />

      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{navLabel}</span>
        <span className="text-sm font-bold text-gray-400 font-mono-en">{data.quotations.length} {t("work")}</span>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        {Object.entries(WORK_STATUS_MAP).map(([key, s]) => {
          const count = data.counts[key] || 0;
          const isActive = activeFilter === key;
          const labelKey = WORK_STATUS_KEYS[key];
          return (
            <button
              key={key}
              onClick={() => { setActiveFilter(isActive ? null : key); setAlertFilter(null); }}
              className={cn(
                "border rounded p-3 text-center transition-all cursor-pointer flex-1 min-w-0",
                s.cardColor,
                isActive && "ring-2 ring-offset-1 ring-gray-900 dark:ring-gray-100"
              )}
            >
              <p className="text-2xl font-black font-mono-en">{count}</p>
              <p className="text-xs font-bold mt-0.5">{labelKey ? t(labelKey) : s.label}</p>
            </button>
          );
        })}
        <button
          onClick={() => { setAlertFilter(alertFilter === "orange" ? null : "orange"); setActiveFilter(null); }}
          className={cn(
            "border rounded p-3 text-center transition-all cursor-pointer flex-1 min-w-0",
            alertFilter === "orange"
              ? "border-orange-300 text-orange-600 bg-orange-50 ring-2 ring-offset-1 ring-gray-900 dark:ring-gray-100"
              : "border-orange-300 text-orange-600 bg-orange-50"
          )}
        >
          <p className="text-2xl font-black font-mono-en">{data.counts.orange || 0}</p>
          <p className="text-xs font-bold mt-0.5">{t("note")}</p>
        </button>
        <button
          onClick={() => { setAlertFilter(alertFilter === "red" ? null : "red"); setActiveFilter(null); }}
          className={cn(
            "border rounded p-3 text-center transition-all cursor-pointer flex-1 min-w-0",
            alertFilter === "red"
              ? "border-red-300 text-red-600 bg-red-50 ring-2 ring-offset-1 ring-gray-900 dark:ring-gray-100"
              : "border-red-300 text-red-600 bg-red-50"
          )}
        >
          <p className="text-2xl font-black font-mono-en">{data.counts.red || 0}</p>
          <p className="text-xs font-bold mt-0.5">{t("urgent")}</p>
        </button>
        {(activeFilter || alertFilter) && (
          <button
            onClick={() => { setActiveFilter(null); setAlertFilter(null); }}
            className="border rounded p-3 text-center transition-all cursor-pointer border-gray-300 text-gray-600 bg-gray-50 flex-1 min-w-0 flex flex-col items-center justify-center"
          >
            <X className="w-5 h-5 mb-0.5" />
            <p className="text-xs font-bold">{t("clear")}</p>
          </button>
        )}
      </div>

      <div className={cn("bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 mb-6", !showFilters && "max-lg:hidden")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pr-10 pl-4"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={deliveryFrom}
              onChange={(e) => setDeliveryFrom(e.target.value)}
              className="field flex-1 min-w-0 font-mono-en"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t("to")}</span>
            <input
              type="date"
              value={deliveryTo}
              onChange={(e) => setDeliveryTo(e.target.value)}
              className="field flex-1 min-w-0 font-mono-en"
            />
          </div>
        </div>
      </div>

      {data.quotations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-12 text-center">
          <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">
            {t("noOrders")}{(deliveryFrom || deliveryTo) ? ` — ${navLabel}` : ""}{activeFilter || alertFilter ? ` ${t("matchingFilter")}` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.quotations.map((q) => {
            const days = getDaysRemaining(q.deliveryDate);
            const autoUrgent = isAutoUrgent(q.deliveryDate, q.workStatus);
            const ws = q.workStatus ? WORK_STATUS_MAP[q.workStatus] : null;
            const wsKey = q.workStatus ? WORK_STATUS_KEYS[q.workStatus] : null;
            const isExpanded = expandedId === q.id;
            const itemSummary = q.items.slice(0, 3).map((it) => locale === "en" ? it.category.nameEn : it.category.nameAr).join(locale === "ar" ? "، " : ", ");

            return (
              <div
                key={q.id}
                className={cn(
                  "bg-white dark:bg-gray-800 border rounded-lg overflow-hidden transition-all",
                  "border-gray-200 dark:border-gray-700",
                  (q.hasRedAlert || autoUrgent) && q.workStatus !== "delivered" && "border-red-300 dark:border-red-700"
                )}
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/quotations/${q.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono-en font-bold text-sm text-gray-900 dark:text-white hover:underline"
                      >
                        {q.quoteNumber}
                      </Link>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{q.customer.name}</span>
                      {ws && wsKey && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", ws.badgeColor)}>
                          {t(wsKey)}
                        </span>
                      )}
                      {q.hasOrangeAlert && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">{t("note")}</span>
                      )}
                      {(q.hasRedAlert || autoUrgent) && q.workStatus !== "delivered" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">{t("urgent")}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {itemSummary}{q.items.length > 3 ? ` +${q.items.length - 3}` : ""}
                    </p>
                    {q.workStatus !== "delivered" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <MaterialBadge label={t("wood")} status={q.woodStatus} onCycle={() => handleMaterialCycle(q.id, "woodStatus", q.woodStatus)} />
                        <MaterialBadge label={t("fabric")} status={q.fabricStatus} onCycle={() => handleMaterialCycle(q.id, "fabricStatus", q.fabricStatus)} />
                      </div>
                    )}
                  </div>

                  <div className="text-left shrink-0 hidden sm:block">
                    <p className="text-xs text-gray-400 font-mono-en">{fmtDate(q.deliveryDate)}</p>
                    <div className="mt-1">
                      <DaysRemainingBadge days={days} workStatus={q.workStatus} />
                    </div>
                  </div>

                  <div className="shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 pb-2 sm:hidden">
                  <p className="text-xs text-gray-400 font-mono-en">{fmtDate(q.deliveryDate)}</p>
                  <DaysRemainingBadge days={days} workStatus={q.workStatus} />
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400 font-bold mb-1">{t("customer")}</p>
                        <p className="text-sm font-semibold">{q.customer.name}</p>
                        <p className="text-xs text-gray-500 font-mono-en">{q.customer.phoneCode} {q.customer.phone}</p>
                        <p className="text-xs text-gray-500">{q.customer.governorate} – {q.customer.wilayat}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-bold mb-1">{t("orderDetails")}</p>
                        <p className="text-xs text-gray-500">{t("employee")}: {q.employee.name}</p>
                        <p className="text-xs text-gray-500">{t("total")}: <span className="font-mono-en font-bold">{q.total.toFixed(3)} {t("omr")}</span></p>
                        <p className="text-xs text-gray-500">{t("itemCount")}: {q.items.length}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-2 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> {t("materialStatus")}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{t("wood")}</p>
                          <div className="flex gap-1.5">
                            {Object.entries(MATERIAL_STATUS_KEYS).map(([key, s]) => (
                              <button
                                key={key}
                                onClick={() => handleMaterialSet(q.id, "woodStatus", key)}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[10px] font-bold border transition-all",
                                  q.woodStatus === key
                                    ? cn(s.color, "ring-1 ring-offset-1 ring-gray-400")
                                    : "border-gray-200 dark:border-gray-600 text-gray-400"
                                )}
                              >
                                {t(s.labelKey)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{t("fabric")}</p>
                          <div className="flex gap-1.5">
                            {Object.entries(MATERIAL_STATUS_KEYS).map(([key, s]) => (
                              <button
                                key={key}
                                onClick={() => handleMaterialSet(q.id, "fabricStatus", key)}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[10px] font-bold border transition-all",
                                  q.fabricStatus === key
                                    ? cn(s.color, "ring-1 ring-offset-1 ring-gray-400")
                                    : "border-gray-200 dark:border-gray-600 text-gray-400"
                                )}
                              >
                                {t(s.labelKey)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-1">{t("items")}</p>
                      <div className="space-y-1">
                        {q.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-mono-en">{i + 1}.</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.description}</span>
                            <span className="text-gray-400">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-2">{t("changeWorkStatus")}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(WORK_STATUS_MAP).map(([key, s]) => {
                          const lk = WORK_STATUS_KEYS[key];
                          return (
                            <button
                              key={key}
                              onClick={() => handleStatusChange(q.id, key)}
                              className={cn(
                                "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                                q.workStatus === key
                                  ? cn(s.cardColor, "ring-1 ring-offset-1 ring-gray-400")
                                  : "border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-400"
                              )}
                            >
                              {lk ? t(lk) : s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleAlertToggle(q.id, "hasOrangeAlert", q.hasOrangeAlert)}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                          q.hasOrangeAlert
                            ? "bg-orange-50 border-orange-300 text-orange-600"
                            : "border-gray-200 dark:border-gray-600 text-gray-500"
                        )}
                      >
                        {q.hasOrangeAlert ? t("removeNote") : t("addNote")}
                      </button>
                      <button
                        onClick={() => handleAlertToggle(q.id, "hasRedAlert", q.hasRedAlert)}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                          q.hasRedAlert
                            ? "bg-red-50 border-red-300 text-red-600"
                            : "border-gray-200 dark:border-gray-600 text-gray-500"
                        )}
                      >
                        {q.hasRedAlert ? t("removeUrgent") : t("markUrgent")}
                      </button>
                      {autoUrgent && q.workStatus !== "delivered" && !q.hasRedAlert && (
                        <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t("autoAlert")}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> {t("workNotes")}
                        </p>
                        {editingNotes !== q.id && (
                          <button
                            onClick={() => { setEditingNotes(q.id); setNotesText(q.workNotes || ""); }}
                            className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold"
                          >
                            {t("edit")}
                          </button>
                        )}
                      </div>
                      {editingNotes === q.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            className="field-textarea min-h-[80px]"
                            placeholder={t("addWorkNotes")}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNotes(q.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white rounded text-xs font-bold"
                            >
                              <Check className="w-3 h-3" /> {t("save")}
                            </button>
                            <button
                              onClick={() => setEditingNotes(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500"
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {q.workNotes || <span className="text-gray-400 dark:text-gray-500 italic">{t("noNotes")}</span>}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {t("openOriginalQuote")}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
