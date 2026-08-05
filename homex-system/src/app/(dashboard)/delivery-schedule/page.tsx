"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { cn, roundMoney } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/hooks";
import { CardsSkeleton } from "@/components/skeleton";
import { daysUntil, URGENCY_GROUPS, NEUTRAL_TONE, daysRemainingLabel } from "@/lib/schedule-utils";
import { renderWaTemplate, waLinkFor, DEFAULT_WA_DELIVERY } from "@/lib/wa";
import { DateDrillNav } from "@/components/date-drill-nav";
import { DeliveryCalendar, type CalItem } from "./delivery-calendar";
import {
  CalendarClock, Phone, MessageCircle, Check, FileText, Search,
  MapPin, Clock, Package, Truck, Printer, Wallet, User, CalendarDays,
  BadgeCheck, RotateCcw, Download,
} from "lucide-react";

interface DeliveryQuotation {
  id: string;
  quoteNumber: string;
  total: number;
  deliveryDate: string;
  deliveryDateEstimated?: boolean;
  deliveryTime: string | null;
  deliveryDriver: string | null;
  deliveryLocation: string | null;
  apptConfirmed: boolean;
  workNotes: string | null;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string; address: string | null };
  employee: { name: string };
  items: Array<{ description: string; quantity: number }>;
  payments: Array<{ amount: number }>;
}

const getDaysRemaining = (d: string) => daysUntil(d) as number;

// Default driver pre-selected for every delivery (still changeable per order).
const DEFAULT_DRIVER = "قصي الشكيلي";

export default function DeliverySchedulePage() {
  const { t, dateLocale } = useI18n();
  const [tab, setTab] = useState<"queue" | "delivered">("queue");
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [showStats, setShowStats] = useState(false);
  const [rows, setRows] = useState<DeliveryQuotation[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [view, setView] = useState<"urgency" | "area">("urgency");
  const [todayOnly, setTodayOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [reschedId, setReschedId] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedTime, setReschedTime] = useState("");
  const [locEditId, setLocEditId] = useState<string | null>(null);
  const [locValue, setLocValue] = useState("");
  const [stats, setStats] = useState<Record<string, number | null> | null>(null);
  // Access flags: read-only viewers (photographer) can't edit; roles without
  // financial access never see money. Default to full access until /api/me loads.
  const [canEdit, setCanEdit] = useState(true);
  const [canMoney, setCanMoney] = useState(true);
  // Editable WhatsApp template + company signature (from settings).
  const [waTemplate, setWaTemplate] = useState("");
  const [company, setCompany] = useState({ name: "", phone: "" });

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (m) { setCanEdit(m.canEditDeliveries !== false); setCanMoney(m.canSeeFinancials !== false); }
    }).catch(() => {});
    fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (s) { setWaTemplate(s.wa_template_delivery || ""); setCompany({ name: s.company_name || "", phone: s.company_phone || "" }); }
    }).catch(() => {});
  }, []);

  const loadStats = useCallback(() => {
    fetch("/api/delivery-stats").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  // The list below always shows every order (only the tab + search apply). The
  // date drill-nav filters the calendar on top, not this list.
  const fetchData = useCallback(() => {
    setRows(null);
    const params = new URLSearchParams({ workStatus: tab === "queue" ? "ready_for_delivery" : "delivered" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    fetch(`/api/work-orders?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.quotations || []))
      .catch(() => setRows([]));
  }, [tab, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load a WHOLE year at once (both queue + delivered) so switching months is
  // instant client-side filtering. Years are cached, and the neighbouring years
  // are prefetched in the background so changing year is instant too.
  const calYear = monthAnchor.getFullYear();
  const [calRows, setCalRows] = useState<DeliveryQuotation[] | null>(null);
  const calCache = useRef<Record<number, DeliveryQuotation[]>>({});
  const fetchYear = useCallback(async (year: number): Promise<DeliveryQuotation[]> => {
    if (calCache.current[year]) return calCache.current[year];
    const from = `${year}-01-01`, to = `${year}-12-31`;
    const qp = (ws: string) => `/api/work-orders?${new URLSearchParams({ workStatus: ws, deliveryFrom: from, deliveryTo: to })}`;
    const [a, b] = await Promise.all([
      fetch(qp("ready_for_delivery")).then((r) => r.json()).catch(() => ({ quotations: [] })),
      fetch(qp("delivered")).then((r) => r.json()).catch(() => ({ quotations: [] })),
    ]);
    const rows = [
      ...(a.quotations || []).map((q: DeliveryQuotation) => ({ ...q, _cal: "ready" })),
      ...(b.quotations || []).map((q: DeliveryQuotation) => ({ ...q, _cal: "delivered" })),
    ];
    calCache.current[year] = rows;
    return rows;
  }, []);
  const loadCalendar = useCallback(() => {
    const cached = calCache.current[calYear];
    if (cached) setCalRows(cached);
    else { setCalRows(null); fetchYear(calYear).then((rows) => setCalRows(rows)).catch(() => setCalRows([])); }
    // Warm the adjacent years silently for instant year switching.
    [calYear - 1, calYear + 1].forEach((yr) => { if (!calCache.current[yr]) fetchYear(yr).catch(() => {}); });
  }, [calYear, fetchYear]);
  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const calItems: CalItem[] = useMemo(() => {
    const s = debouncedSearch.trim();
    return (calRows || [])
      .filter((q) => q.deliveryDate)
      .map((q) => {
        const cal = (q as DeliveryQuotation & { _cal?: string })._cal;
        const late = cal !== "delivered" && (daysUntil(q.deliveryDate) ?? 0) < 0;
        return {
          id: q.id,
          name: q.customer?.name || "—",
          wilayat: q.customer?.wilayat || "",
          governorate: q.customer?.governorate || "",
          quoteNumber: q.quoteNumber,
          phone: q.customer?.phone || "",
          phoneCode: q.customer?.phoneCode || "+968",
          date: q.deliveryDate,
          time: q.deliveryTime,
          driver: q.deliveryDriver || DEFAULT_DRIVER,
          status: cal === "delivered" ? "delivered" : late ? "late" : "ready",
        } as CalItem;
      })
      .filter((it) => !s || it.name.includes(s) || it.wilayat.includes(s) || it.driver.includes(s));
  }, [calRows, debouncedSearch]);

  // The calendar only needs the anchored month — filtered from the year in memory.
  const monthItems: CalItem[] = useMemo(() => calItems.filter((it) => {
    const d = new Date(it.date);
    return d.getFullYear() === monthAnchor.getFullYear() && d.getMonth() === monthAnchor.getMonth();
  }), [calItems, monthAnchor]);

  const reschedule = (id: string, date: string) => {
    // Update in memory (and cache) only — no reload, so month switching stays instant.
    setCalRows((prev) => {
      const next = prev ? prev.map((q) => (q.id === id ? { ...q, deliveryDate: date, deliveryDateEstimated: false } : q)) : prev;
      if (next) calCache.current[calYear] = next;
      return next;
    });
    fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deliveryDate: date }),
    }).then(() => { loadStats(); }).catch(() => {});
  };

  // A list action (mark delivered / return to queue) changes a delivery's
  // status, so the cached calendar is stale — drop it and reload.
  const refreshCalendar = useCallback(() => { calCache.current = {}; loadCalendar(); }, [loadCalendar]);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => setDrivers((list || []).filter((e) => e.isActive !== false).map((e) => e.name)))
      .catch(() => {});
  }, []);

  const patch = (id: string, body: Record<string, any>, patchLocal: Partial<DeliveryQuotation>) => {
    setRows((prev) => (prev ? prev.map((q) => (q.id === id ? { ...q, ...patchLocal } : q)) : prev));
    fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => fetchData());
  };

  const remainingOf = (q: DeliveryQuotation) =>
    roundMoney(q.total - q.payments.reduce((s, p) => roundMoney(s + p.amount), 0));

  const markDelivered = async (q: DeliveryQuotation) => {
    const remaining = remainingOf(q);
    let collect = false;
    // Only prompt to collect the balance for roles allowed to see money.
    if (remaining > 0 && canMoney) {
      collect = confirm(t("collectPrompt").replace("{amount}", `${remaining.toFixed(3)} ${t("omr")}`));
    } else {
      if (!confirm(t("confirmDelivered"))) return;
    }
    setBusyId(q.id);
    setRows((prev) => (prev ? prev.filter((r) => r.id !== q.id) : prev));
    try {
      if (collect && remaining > 0) {
        await fetch("/api/payments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quotationId: q.id, amount: remaining, method: "cash", notes: t("deliveredOn") }),
        });
      }
      await fetch("/api/work-orders", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        // Persist the effective driver (the default when none was picked) so the
        // delivered record reflects who actually took it.
        body: JSON.stringify({ id: q.id, workStatus: "delivered", deliveryDriver: q.deliveryDriver || DEFAULT_DRIVER }),
      });
    } catch {
      fetchData();
    } finally { setBusyId(null); loadStats(); refreshCalendar(); }
  };

  const revertToQueue = (id: string) => {
    if (!confirm(t("confirmReturnToQueue"))) return;
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, workStatus: "ready_for_delivery" }),
    }).then(() => refreshCalendar()).catch(() => fetchData());
  };

  const openReschedule = (q: DeliveryQuotation) => {
    setReschedId(q.id);
    setReschedDate(q.deliveryDate ? new Date(q.deliveryDate).toISOString().split("T")[0] : "");
    setReschedTime(q.deliveryTime || "");
  };

  const saveReschedule = () => {
    if (!reschedId || !reschedDate) { setReschedId(null); return; }
    const id = reschedId;
    setReschedId(null);
    fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deliveryDate: reschedDate, deliveryTime: reschedTime || null }),
    }).then(() => fetchData()).catch(() => fetchData());
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const fmtCur = (n: number) => `${roundMoney(n).toFixed(3)} ${t("omr")}`;

  const daysLabel = (d: number) => daysRemainingLabel(d, t);

  const waLink = (q: DeliveryQuotation) => {
    const msg = renderWaTemplate(waTemplate || DEFAULT_WA_DELIVERY, {
      customer: q.customer.name,
      number: q.quoteNumber,
      date: fmtDate(q.deliveryDate),
      time: q.deliveryTime || "",
      location: q.deliveryLocation || "",
      company: company.name,
      companyPhone: company.phone,
    });
    return waLinkFor(q.customer.phoneCode || "+968", q.customer.phone, msg);
  };

  const mapsLink = (q: DeliveryQuotation) => {
    const query = [q.customer.address, q.customer.wilayat, q.customer.governorate, "Oman"].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  // An exact location the customer sent: use a pasted URL as-is, otherwise
  // treat the value as coordinates/text and build a maps query from it.
  const preciseHref = (loc: string) =>
    loc.trim().startsWith("http") ? loc.trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.trim())}`;

  const openLocEditor = (q: DeliveryQuotation) => { setLocEditId(q.id); setLocValue(q.deliveryLocation || ""); };
  const saveLocation = () => {
    if (!locEditId) return;
    const id = locEditId;
    const val = locValue.trim();
    setLocEditId(null);
    patch(id, { deliveryLocation: val }, { deliveryLocation: val || null });
  };
  const clearLocation = (id: string) => patch(id, { deliveryLocation: "" }, { deliveryLocation: null });

  // Apply "today only" filter, then bucket.
  const visible = useMemo(() => {
    let list = rows || [];
    if (todayOnly) list = list.filter((q) => getDaysRemaining(q.deliveryDate) === 0);
    return list;
  }, [rows, todayOnly]);

  const sections = useMemo(() => {
    if (view === "area") {
      const byArea: Record<string, DeliveryQuotation[]> = {};
      for (const q of visible) {
        const key = `${q.customer.governorate} — ${q.customer.wilayat}`;
        (byArea[key] ||= []).push(q);
      }
      return Object.entries(byArea)
        .sort((a, b) => a[0].localeCompare(b[0], "ar"))
        .map(([label, items]) => ({ key: label, label, tone: NEUTRAL_TONE, items }));
    }
    return URGENCY_GROUPS.map((g) => ({
      key: g.key,
      label: t(g.labelKey),
      tone: g.tone,
      items: visible.filter((q) => g.test(getDaysRemaining(q.deliveryDate))),
    })).filter((s) => s.items.length > 0);
  }, [visible, view, t]);

  const total = visible.length;
  const totalToCollect = useMemo(
    () => visible.reduce((s, q) => roundMoney(s + remainingOf(q)), 0),
    [visible] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6" />
            {t("deliveryScheduleTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("deliveryScheduleSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {canMoney && tab === "queue" && totalToCollect > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 self-start bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-3 h-11 rounded-lg text-sm font-bold">
              <Wallet className="w-4 h-4" /> <span className="font-mono-en">{fmtCur(totalToCollect)}</span>
            </span>
          )}
          <button onClick={() => setShowStats((v) => !v)}
            className={cn("no-print inline-flex items-center gap-2 self-start px-4 h-11 rounded-lg text-sm font-bold border transition-colors",
              showStats ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700")}>
            <BadgeCheck className="w-4 h-4" /> {t("statsToggle")}
          </button>
          <a href="/api/export?type=deliveries" className="no-print inline-flex items-center gap-2 self-start border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 h-11 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" title="تنزيل جدول التوصيل Excel/CSV">
            <Download className="w-4 h-4" /> تصدير
          </a>
          <span className="inline-flex items-center gap-2 self-start bg-teal-600 text-white px-4 h-11 rounded-lg text-sm font-bold">
            <Truck className="w-4 h-4" />
            <span className="font-mono-en">{total}</span> {t("deliveryCount")}
          </span>
        </div>
      </div>

      {/* KPI strip — collapsed by default to keep the page light */}
      {stats && showStats && (
        <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5 hx-fade">
          {[
            { label: t("kpiThisWeek"), value: stats.queueThisWeek ?? 0, tone: "text-teal-600 dark:text-teal-400" },
            { label: t("kpiOverdue"), value: stats.queueOverdue ?? 0, tone: "text-red-600 dark:text-red-400" },
            // Money KPI only for roles allowed to see amounts.
            ...(canMoney ? [{ label: t("kpiToCollect"), value: fmtCur(Number(stats.toCollect || 0)), tone: "text-amber-600 dark:text-amber-400", small: true }] : []),
            { label: t("kpiOnTime"), value: stats.onTimePct === null ? "—" : `${stats.onTimePct}%`, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: t("kpiOpenServices"), value: stats.openServices ?? 0, tone: "text-purple-600 dark:text-purple-400" },
          ].map((k, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-gray-400 font-semibold mb-1 leading-tight">{k.label}</p>
              <p className={cn("font-black font-mono-en", k.small ? "text-sm" : "text-xl", k.tone)}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + controls (hidden when printing) */}
      <div className="no-print space-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {(["queue", "delivered"] as const).map((k) => (
            <button key={k} onClick={() => { setTab(k); setTodayOnly(false); }}
              className={cn("px-4 h-10 rounded-lg text-sm font-bold border transition-colors",
                tab === k ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400")}>
              {k === "queue" ? t("tabQueue") : t("tabDelivered")}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Printer className="w-4 h-4" /> {t("printSheet")}
          </button>
        </div>

        {/* Date drill-nav (year → month) — jumps the calendar to that month. */}
        <DateDrillNav stopAtMonth onChange={(r) => setMonthAnchor(r ? new Date(r.from + "T00:00:00") : new Date())} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="field pr-10 pl-3" placeholder={t("searchDeliveries")} />
          </div>
          {tab === "queue" && (
            <>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-11">
                {(["urgency", "area"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={cn("px-3 text-xs font-bold transition-colors",
                      view === v ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white dark:bg-gray-800 text-gray-500")}>
                    {v === "urgency" ? t("viewByUrgency") : t("viewByArea")}
                  </button>
                ))}
              </div>
              <button onClick={() => setTodayOnly((v) => !v)}
                className={cn("inline-flex items-center gap-1.5 px-3 h-11 rounded-lg border text-xs font-bold transition-colors",
                  todayOnly ? "bg-red-600 text-white border-red-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
                <CalendarDays className="w-3.5 h-3.5" /> {t("todayOnly")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Print-only title */}
      <div className="hidden print:block mb-3">
        <h2 className="text-lg font-bold">{t("deliverySheetTitle")} — <span className="font-mono-en">{new Date().toLocaleDateString(dateLocale)}</span></h2>
      </div>

      {/* Calendar (top) — weekly, navigated by the drill-nav or the arrows.
          Separate from the list. */}
      <div className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/30 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-300">{t("calendarHeading")}</h2>
        </div>
        {calRows === null ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-teal-500 animate-spin" />
            <p className="text-sm font-semibold">جارٍ تحميل توصيلات <span className="font-mono-en">{calYear}</span>…</p>
          </div>
        ) : (
          <DeliveryCalendar
            monthAnchor={monthAnchor}
            items={monthItems}
            onToday={() => setMonthAnchor(new Date())}
            onPrevMonth={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            onReschedule={reschedule}
            canEdit={canEdit}
          />
        )}
      </div>

      {/* Detailed list below — always shows every order, unaffected by the date
          selection. An order stays here until it is marked delivered. */}
      {rows !== null && total > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-300">{tab === "queue" ? t("tabQueue") : t("tabDelivered")}</h2>
          <span className="text-xs text-gray-400 font-mono-en">{total}</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
        </div>
      )}

      {rows === null ? (
        <CardsSkeleton count={3} />
      ) : total === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-500 mb-1">{tab === "queue" ? t("noDeliveries") : t("noDeliveredYet")}</p>
          {tab === "queue" && <p className="text-sm text-gray-400 max-w-md mx-auto">{t("noDeliveriesHint")}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", s.tone)}>{s.label}</span>
                <span className="text-xs text-gray-400 font-mono-en">{s.items.length}</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
              </div>
              <div className="space-y-3">
                {s.items.map((q) => {
                  const days = getDaysRemaining(q.deliveryDate);
                  const remaining = remainingOf(q);
                  const telNumber = `${q.customer.phoneCode}${q.customer.phone}`;
                  const isDelivered = tab === "delivered";
                  return (
                    <div key={q.id} className={cn("bg-white dark:bg-gray-800 border rounded-xl p-4",
                      q.apptConfirmed && !isDelivered ? "border-emerald-300 dark:border-emerald-700" : "border-gray-200 dark:border-gray-700")}>
                      {/* Top row */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{q.customer.name}</h3>
                            {!isDelivered && (
                              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", s.tone)}>{daysLabel(days)}</span>
                            )}
                            {q.apptConfirmed && !isDelivered && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <BadgeCheck className="w-3 h-3" /> {t("apptConfirmedLabel")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                            <MapPin className="w-3 h-3" /> {q.customer.governorate} — {q.customer.wilayat}
                            <span className="mx-1">·</span>
                            <span className="font-mono-en">{q.quoteNumber}</span>
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <CalendarClock className="w-4 h-4 text-teal-600" />
                            <span className="font-mono-en">{fmtDate(q.deliveryDate)}</span>
                            {q.deliveryDateEstimated && (
                              <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" title="تاريخ تقديري من الاستيراد — يُرجى تأكيده يدوياً">تقديري</span>
                            )}
                          </p>
                          {q.deliveryTime && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" /> <span className="font-mono-en">{q.deliveryTime}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Remaining balance — money is hidden from roles without
                          financial access (driver / photographer). */}
                      {canMoney && (remaining > 0 ? (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm font-bold">
                          <Wallet className="w-4 h-4" /> {t("toCollect")}: <span className="font-mono-en">{fmtCur(remaining)}</span>
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
                          <Check className="w-4 h-4" /> {t("fullyPaid")}
                        </div>
                      ))}

                      {/* Contact + maps. The exact pin the employee enters here
                          is shared with the photographer once the job moves to
                          photos. */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-sm font-mono-en font-semibold text-gray-700 dark:text-gray-200" dir="ltr">{telNumber}</span>
                        <a href={`tel:${telNumber}`} className="no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold hover:opacity-90 transition-opacity">
                          <Phone className="w-3.5 h-3.5" /> {t("callAction")}
                        </a>
                        <a href={waLink(q)} target="_blank" rel="noopener noreferrer" className="no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" /> {t("whatsappAction")}
                        </a>
                        {q.deliveryLocation ? (
                          <a href={preciseHref(q.deliveryLocation)} target="_blank" rel="noopener noreferrer" className="no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors">
                            <MapPin className="w-3.5 h-3.5" /> {t("preciseLocation")}
                          </a>
                        ) : (
                          <a href={mapsLink(q)} target="_blank" rel="noopener noreferrer" className="no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <MapPin className="w-3.5 h-3.5" /> {t("openMaps")}
                          </a>
                        )}
                      </div>

                      {/* Items */}
                      {q.items.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {q.items.map((it, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              <Package className="w-3 h-3 text-gray-400" /> {it.description} ×{it.quantity}
                            </span>
                          ))}
                        </div>
                      )}

                      {q.workNotes && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap border-r-2 border-gray-200 dark:border-gray-600 pr-2">{q.workNotes}</p>
                      )}

                      {/* Driver + appointment + actions (queue only, editors only) */}
                      {!isDelivered && canEdit && (
                        <div className="no-print mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500"><User className="w-3.5 h-3.5" /> {t("driverLabel")}:</span>
                            <select value={q.deliveryDriver || DEFAULT_DRIVER}
                              onChange={(e) => patch(q.id, { deliveryDriver: e.target.value }, { deliveryDriver: e.target.value })}
                              className="field w-auto h-9 text-xs py-0">
                              <option value="">{t("noDriver")}</option>
                              {!drivers.includes(DEFAULT_DRIVER) && <option value={DEFAULT_DRIVER}>{DEFAULT_DRIVER}</option>}
                              {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                              {q.deliveryDriver && q.deliveryDriver !== DEFAULT_DRIVER && !drivers.includes(q.deliveryDriver) && <option value={q.deliveryDriver}>{q.deliveryDriver}</option>}
                            </select>
                            <button onClick={() => patch(q.id, { apptConfirmed: !q.apptConfirmed }, { apptConfirmed: !q.apptConfirmed })}
                              className={cn("inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-bold transition-colors",
                                q.apptConfirmed ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
                              <BadgeCheck className="w-3.5 h-3.5" /> {q.apptConfirmed ? t("apptConfirmedLabel") : t("confirmAppt")}
                            </button>
                            <button onClick={() => openReschedule(q)}
                              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                              <CalendarDays className="w-3.5 h-3.5" /> {t("reschedule")}
                            </button>
                            <button onClick={() => openLocEditor(q)}
                              className={cn("inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-bold transition-colors",
                                q.deliveryLocation ? "bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300"
                                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700")}>
                              <MapPin className="w-3.5 h-3.5" /> {q.deliveryLocation ? t("preciseLocation") : t("addLocation")}
                            </button>
                          </div>

                          {reschedId === q.id && (
                            <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                              <input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} className="field w-auto h-9 font-mono-en" />
                              <input type="time" value={reschedTime} onChange={(e) => setReschedTime(e.target.value)} className="field w-28 h-9 font-mono-en" />
                              <button onClick={saveReschedule} className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold">
                                <Check className="w-3.5 h-3.5" /> {t("saveAppt")}
                              </button>
                              <button onClick={() => setReschedId(null)} className="px-3 h-9 text-xs font-bold text-gray-500">{t("cancel")}</button>
                            </div>
                          )}

                          {locEditId === q.id && (
                            <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                              <input type="url" value={locValue} onChange={(e) => setLocValue(e.target.value)} dir="ltr" autoFocus
                                className="field flex-1 min-w-[200px] h-9 font-mono-en text-xs" placeholder={t("pasteLocation")} />
                              <button onClick={saveLocation} className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold">
                                <Check className="w-3.5 h-3.5" /> {t("saveAppt")}
                              </button>
                              {q.deliveryLocation && (
                                <button onClick={() => { clearLocation(q.id); setLocEditId(null); }} className="px-3 h-9 text-xs font-bold text-red-500">{t("clearLocation")}</button>
                              )}
                              <button onClick={() => setLocEditId(null)} className="px-3 h-9 text-xs font-bold text-gray-500">{t("cancel")}</button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer actions. The original quote (which shows prices)
                          is only linked for roles allowed to see money. */}
                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        {canMoney ? (
                          <Link href={`/quotations/${q.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:underline">
                            <FileText className="w-3.5 h-3.5" /> {t("openOriginalQuote")}
                          </Link>
                        ) : <span />}
                        {canEdit && (isDelivered ? (
                          <button onClick={() => revertToQueue(q.id)} className="no-print inline-flex items-center gap-1.5 px-4 h-10 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                            <RotateCcw className="w-4 h-4" /> {t("returnToQueue")}
                          </button>
                        ) : (
                          <button onClick={() => markDelivered(q)} disabled={busyId === q.id}
                            className="no-print inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                            <Check className="w-4 h-4" /> {t("markDelivered")}
                          </button>
                        ))}
                      </div>

                      {/* Driver line shown on print */}
                      {q.deliveryDriver && (
                        <p className="hidden print:block mt-2 text-xs font-bold">{t("driverLabel")}: {q.deliveryDriver}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
