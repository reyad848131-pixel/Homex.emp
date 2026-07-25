"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/hooks";
import { CardsSkeleton } from "@/components/skeleton";
import {
  CalendarClock, Phone, MessageCircle, Check, FileText, Search,
  MapPin, Clock, Package, Truck,
} from "lucide-react";

interface DeliveryQuotation {
  id: string;
  quoteNumber: string;
  total: number;
  deliveryDate: string;
  deliveryTime: string | null;
  workNotes: string | null;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string };
  employee: { name: string };
  items: Array<{ description: string; quantity: number }>;
}

function getDaysRemaining(deliveryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  return Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Ordered urgency buckets — nearest first. Each row lands in the first bucket
// whose test passes, so the schedule reads top-to-bottom by how soon it's due.
const GROUPS: Array<{ key: string; labelKey: TranslationKey; test: (d: number) => boolean; tone: string }> = [
  { key: "overdue", labelKey: "grpOverdue", test: (d) => d < 0, tone: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  { key: "thisWeek", labelKey: "grpThisWeek", test: (d) => d >= 0 && d <= 7, tone: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
  { key: "nextWeek", labelKey: "grpNextWeek", test: (d) => d >= 8 && d <= 14, tone: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  { key: "thisMonth", labelKey: "grpThisMonth", test: (d) => d >= 15 && d <= 31, tone: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "later", labelKey: "grpLater", test: (d) => d > 31, tone: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600" },
];

export default function DeliverySchedulePage() {
  const { t, dateLocale } = useI18n();
  const [rows, setRows] = useState<DeliveryQuotation[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const params = new URLSearchParams({ workStatus: "ready_for_delivery" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    fetch(`/api/work-orders?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.quotations || []))
      .catch(() => setRows([]));
  }, [debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markDelivered = (id: string) => {
    if (!confirm(t("confirmDelivered"))) return;
    setBusyId(id);
    setRows((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));
    fetch("/api/work-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, workStatus: "delivered" }),
    }).catch(() => fetchData()).finally(() => setBusyId(null));
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale, { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const daysLabel = (d: number) => {
    if (d < 0) return `${t("lateBy")} ${Math.abs(d)} ${t("day")}`;
    if (d === 0) return t("today");
    return `${d} ${t("day")}`;
  };

  // Bucket the (already date+time sorted) rows into urgency groups.
  const grouped = useMemo(() => {
    const map: Record<string, DeliveryQuotation[]> = {};
    for (const g of GROUPS) map[g.key] = [];
    for (const q of rows || []) {
      const d = getDaysRemaining(q.deliveryDate);
      const g = GROUPS.find((g) => g.test(d)) || GROUPS[GROUPS.length - 1];
      map[g.key].push(q);
    }
    return map;
  }, [rows]);

  const total = rows?.length || 0;

  if (rows === null) {
    return (
      <div className="space-y-4">
        <CardsSkeleton count={3} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6" />
            {t("deliveryScheduleTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("deliveryScheduleSubtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 self-start bg-teal-600 text-white px-4 h-11 rounded-lg text-sm font-bold">
          <Truck className="w-4 h-4" />
          <span className="font-mono-en">{total}</span> {t("deliveryCount")}
        </span>
      </div>

      <div className="relative mb-5">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          className="field pr-10 pl-3"
          placeholder={t("searchDeliveries")}
        />
      </div>

      {total === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-500 mb-1">{t("noDeliveries")}</p>
          <p className="text-sm text-gray-400 max-w-md mx-auto">{t("noDeliveriesHint")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const items = grouped[g.key];
            if (!items || items.length === 0) return null;
            return (
              <section key={g.key}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", g.tone)}>
                    {t(g.labelKey)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono-en">{items.length}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                </div>
                <div className="space-y-3">
                  {items.map((q) => {
                    const days = getDaysRemaining(q.deliveryDate);
                    const waNumber = `${q.customer.phoneCode}${q.customer.phone}`.replace(/[^0-9]/g, "");
                    const telNumber = `${q.customer.phoneCode}${q.customer.phone}`;
                    return (
                      <div key={q.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white">{q.customer.name}</h3>
                              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", g.tone)}>
                                {daysLabel(days)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {q.customer.governorate} — {q.customer.wilayat}
                              <span className="mx-1">·</span>
                              <span className="font-mono-en">{q.quoteNumber}</span>
                            </p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <CalendarClock className="w-4 h-4 text-teal-600" />
                              <span className="font-mono-en">{fmtDate(q.deliveryDate)}</span>
                            </p>
                            {q.deliveryTime && (
                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 justify-end">
                                <Clock className="w-3 h-3" /> <span className="font-mono-en">{q.deliveryTime}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Contact + phone */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="text-sm font-mono-en font-semibold text-gray-700 dark:text-gray-200" dir="ltr">
                            {telNumber}
                          </span>
                          <a href={`tel:${telNumber}`}
                            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold hover:opacity-90 transition-opacity">
                            <Phone className="w-3.5 h-3.5" /> {t("callAction")}
                          </a>
                          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" /> {t("whatsappAction")}
                          </a>
                        </div>

                        {/* Items */}
                        {q.items.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {q.items.map((it, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                <Package className="w-3 h-3 text-gray-400" />
                                {it.description} ×{it.quantity}
                              </span>
                            ))}
                          </div>
                        )}

                        {q.workNotes && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap border-r-2 border-gray-200 dark:border-gray-600 pr-2">
                            {q.workNotes}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <Link href={`/quotations/${q.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:underline">
                            <FileText className="w-3.5 h-3.5" /> {t("openOriginalQuote")}
                          </Link>
                          <button
                            onClick={() => markDelivered(q.id)}
                            disabled={busyId === q.id}
                            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" /> {t("markDelivered")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
