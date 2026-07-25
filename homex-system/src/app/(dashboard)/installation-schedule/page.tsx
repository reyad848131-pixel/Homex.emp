"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/hooks";
import { CardsSkeleton } from "@/components/skeleton";
import { daysUntil, URGENCY_GROUPS, daysRemainingLabel } from "@/lib/schedule-utils";
import {
  Wrench, Phone, MessageCircle, Check, FileText, Search,
  MapPin, Clock, Package, CalendarDays, User, Printer, RotateCcw,
} from "lucide-react";

interface InstallQuotation {
  id: string;
  quoteNumber: string;
  installTechnician: string | null;
  installDate: string | null;
  installTime: string | null;
  deliveryLocation: string | null;
  workNotes: string | null;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string; address: string | null };
  items: Array<{ description: string; quantity: number }>;
}

const daysFrom = daysUntil;

export default function InstallationSchedulePage() {
  const { t, dateLocale } = useI18n();
  const [tab, setTab] = useState<"queue" | "done">("queue");
  const [rows, setRows] = useState<InstallQuotation[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [techs, setTechs] = useState<string[]>([]);
  const [schedId, setSchedId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");

  const fetchData = useCallback(() => {
    setRows(null);
    const params = new URLSearchParams({ workStatus: tab === "queue" ? "ready_for_install" : "installed" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    fetch(`/api/work-orders?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.quotations || []))
      .catch(() => setRows([]));
  }, [tab, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    fetch("/api/employees").then((r) => (r.ok ? r.json() : [])).then((list: any[]) =>
      setTechs((list || []).filter((e) => e.isActive !== false).map((e) => e.name))).catch(() => {});
  }, []);

  const patch = (id: string, body: Record<string, any>, patchLocal: Partial<InstallQuotation>) => {
    setRows((prev) => (prev ? prev.map((q) => (q.id === id ? { ...q, ...patchLocal } : q)) : prev));
    fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) })
      .catch(() => fetchData());
  };

  const markInstalled = (id: string) => {
    if (!confirm(t("confirmInstalled"))) return;
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, workStatus: "installed" }) })
      .catch(() => fetchData());
  };

  const revert = (id: string) => {
    if (!confirm(t("confirmReturnToQueue"))) return;
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, workStatus: "ready_for_install" }) })
      .catch(() => fetchData());
  };

  const openSched = (q: InstallQuotation) => {
    setSchedId(q.id);
    setSchedDate(q.installDate ? new Date(q.installDate).toISOString().split("T")[0] : "");
    setSchedTime(q.installTime || "");
  };
  const saveSched = () => {
    if (!schedId) return;
    const id = schedId; setSchedId(null);
    fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, installDate: schedDate || null, installTime: schedTime || null }) })
      .then(() => fetchData()).catch(() => fetchData());
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const daysLabel = (d: number) => daysRemainingLabel(d, t);

  const waLink = (q: InstallQuotation) => {
    const num = `${q.customer.phoneCode}${q.customer.phone}`.replace(/[^0-9]/g, "");
    const when = q.installDate ? `${fmtDate(q.installDate)}${q.installTime ? ` - ${q.installTime}` : ""}` : "";
    const msg = `${t("waGreeting")} ${q.customer.name} 👋\n${t("waAppointment")}${when ? `: ${when}` : ""}\n${t("waConfirmAsk")} 🙏`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };
  const mapsHref = (q: InstallQuotation) => {
    if (q.deliveryLocation) return q.deliveryLocation.trim().startsWith("http") ? q.deliveryLocation.trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.deliveryLocation.trim())}`;
    const query = [q.customer.address, q.customer.wilayat, q.customer.governorate, "Oman"].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const list = rows || [];
  // Sort by install date (unscheduled last), then bucket by urgency.
  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      if (!a.installDate && !b.installDate) return 0;
      if (!a.installDate) return 1;
      if (!b.installDate) return -1;
      const d = new Date(a.installDate).getTime() - new Date(b.installDate).getTime();
      if (d !== 0) return d;
      return (a.installTime || "").localeCompare(b.installTime || "");
    });
  }, [list]);

  const sections = useMemo(() => {
    const unscheduled = sorted.filter((q) => !q.installDate);
    const scheduled = sorted.filter((q) => q.installDate);
    const secs = URGENCY_GROUPS.map((g) => ({
      key: g.key, label: t(g.labelKey), tone: g.tone,
      items: scheduled.filter((q) => g.test(daysFrom(q.installDate) as number)),
    })).filter((s) => s.items.length > 0);
    if (unscheduled.length) secs.push({ key: "unscheduled", label: t("setInstallDate"), tone: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600", items: unscheduled });
    return secs;
  }, [sorted, t]);

  const total = list.length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="w-6 h-6" /> {t("installScheduleTitle")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("installScheduleSubtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 self-start bg-indigo-600 text-white px-4 h-11 rounded-lg text-sm font-bold">
          <Wrench className="w-4 h-4" /> <span className="font-mono-en">{total}</span> {t("installCount")}
        </span>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        {(["queue", "done"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("px-4 h-10 rounded-lg text-sm font-bold border transition-colors",
              tab === k ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400")}>
            {k === "queue" ? t("installSchedule") : t("installedLabel")}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Printer className="w-4 h-4" /> {t("printSheet")}
        </button>
      </div>

      <div className="no-print relative mb-5">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="field pr-10 pl-3" placeholder={t("searchDeliveries")} />
      </div>

      {rows === null ? (
        <CardsSkeleton count={3} />
      ) : total === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-500 mb-1">{t("noInstalls")}</p>
          {tab === "queue" && <p className="text-sm text-gray-400 max-w-md mx-auto">{t("noInstallsHint")}</p>}
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
                  const days = daysFrom(q.installDate);
                  const telNumber = `${q.customer.phoneCode}${q.customer.phone}`;
                  const isDone = tab === "done";
                  return (
                    <div key={q.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{q.customer.name}</h3>
                            {!isDone && days !== null && <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", s.tone)}>{daysLabel(days)}</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                            <MapPin className="w-3 h-3" /> {q.customer.governorate} — {q.customer.wilayat}
                            <span className="mx-1">·</span><span className="font-mono-en">{q.quoteNumber}</span>
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          {q.installDate ? (
                            <>
                              <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5"><Wrench className="w-4 h-4 text-indigo-600" /> <span className="font-mono-en">{fmtDate(q.installDate)}</span></p>
                              {q.installTime && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> <span className="font-mono-en">{q.installTime}</span></p>}
                            </>
                          ) : <span className="text-xs text-amber-600 font-bold">{t("setInstallDate")}</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-sm font-mono-en font-semibold text-gray-700 dark:text-gray-200" dir="ltr">{telNumber}</span>
                        <a href={`tel:${telNumber}`} className="no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold hover:opacity-90"><Phone className="w-3.5 h-3.5" /> {t("callAction")}</a>
                        <a href={waLink(q)} target="_blank" rel="noopener noreferrer" className="no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700"><MessageCircle className="w-3.5 h-3.5" /> {t("whatsappAction")}</a>
                        <a href={mapsHref(q)} target="_blank" rel="noopener noreferrer" className={cn("no-print inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-colors", q.deliveryLocation ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700")}><MapPin className="w-3.5 h-3.5" /> {q.deliveryLocation ? t("preciseLocation") : t("openMaps")}</a>
                      </div>

                      {q.items.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {q.items.map((it, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><Package className="w-3 h-3 text-gray-400" /> {it.description} ×{it.quantity}</span>
                          ))}
                        </div>
                      )}

                      {q.workNotes && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap border-r-2 border-gray-200 dark:border-gray-600 pr-2">{q.workNotes}</p>}

                      {!isDone && (
                        <div className="no-print mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500"><User className="w-3.5 h-3.5" /> {t("technicianLabel")}:</span>
                          <select value={q.installTechnician || ""} onChange={(e) => patch(q.id, { installTechnician: e.target.value }, { installTechnician: e.target.value })} className="field w-auto h-9 text-xs py-0">
                            <option value="">{t("noTech")}</option>
                            {techs.map((d) => <option key={d} value={d}>{d}</option>)}
                            {q.installTechnician && !techs.includes(q.installTechnician) && <option value={q.installTechnician}>{q.installTechnician}</option>}
                          </select>
                          <button onClick={() => openSched(q)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><CalendarDays className="w-3.5 h-3.5" /> {t("installDateLabel")}</button>
                        </div>
                      )}

                      {schedId === q.id && (
                        <div className="no-print mt-2 flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                          <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="field w-auto h-9 font-mono-en" />
                          <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="field w-28 h-9 font-mono-en" />
                          <button onClick={saveSched} className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold"><Check className="w-3.5 h-3.5" /> {t("saveAppt")}</button>
                          <button onClick={() => setSchedId(null)} className="px-3 h-9 text-xs font-bold text-gray-500">{t("cancel")}</button>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <Link href={`/quotations/${q.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:underline"><FileText className="w-3.5 h-3.5" /> {t("openOriginalQuote")}</Link>
                        {isDone ? (
                          <button onClick={() => revert(q.id)} className="no-print inline-flex items-center gap-1.5 px-4 h-10 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40"><RotateCcw className="w-4 h-4" /> {t("returnToQueue")}</button>
                        ) : (
                          <button onClick={() => markInstalled(q.id)} className="no-print inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"><Check className="w-4 h-4" /> {t("markInstalled")}</button>
                        )}
                      </div>

                      {q.installTechnician && <p className="hidden print:block mt-2 text-xs font-bold">{t("technicianLabel")}: {q.installTechnician}</p>}
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
