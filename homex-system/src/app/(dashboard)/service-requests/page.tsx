"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { CardsSkeleton } from "@/components/skeleton";
import {
  LifeBuoy, Plus, Phone, FileText, Check, CalendarDays, User, RotateCcw, MapPin,
} from "lucide-react";

interface ServiceRequest {
  id: string;
  type: string;
  reason: string | null;
  status: string;
  scheduledDate: string | null;
  technician: string | null;
  notes: string | null;
  createdAt: string;
  quotation: {
    id: string; quoteNumber: string;
    customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string };
  };
}

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
};
const STATUS_KEY: Record<string, TranslationKey> = { open: "svcOpen", scheduled: "svcScheduled", resolved: "svcResolved" };

export default function ServiceRequestsPage() {
  const { t, dateLocale } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<ServiceRequest[] | null>(null);
  const [filter, setFilter] = useState<string>("open");
  const [techs, setTechs] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ quoteNumber: "", type: "maintenance", reason: "" });
  const [saving, setSaving] = useState(false);
  const [schedId, setSchedId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTech, setSchedTech] = useState("");

  const fetchData = useCallback(() => {
    setRows(null);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    fetch(`/api/service-requests?${params}`).then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    fetch("/api/employees").then((r) => (r.ok ? r.json() : [])).then((list: any[]) =>
      setTechs((list || []).filter((e) => e.isActive !== false).map((e) => e.name))).catch(() => {});
  }, []);

  const submit = async () => {
    if (!form.quoteNumber.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(t("savedSuccess"));
        setShowForm(false); setForm({ quoteNumber: "", type: "maintenance", reason: "" });
        setFilter("open"); fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("saveFailed"));
      }
    } catch { toast.error(t("serverConnectionError")); }
    finally { setSaving(false); }
  };

  const patch = (id: string, body: Record<string, any>) => {
    fetch(`/api/service-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(() => fetchData()).catch(() => fetchData());
  };

  const openSched = (r: ServiceRequest) => {
    setSchedId(r.id);
    setSchedDate(r.scheduledDate ? new Date(r.scheduledDate).toISOString().split("T")[0] : "");
    setSchedTech(r.technician || "");
  };
  const saveSched = () => {
    if (!schedId) return;
    patch(schedId, { scheduledDate: schedDate || null, technician: schedTech || null, status: "scheduled" });
    setSchedId(null);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><LifeBuoy className="w-6 h-6" /> {t("serviceRequestsTitle")}</h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 self-start bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-4 h-11 rounded-lg text-sm font-bold hover:opacity-90">
          <Plus className="w-4 h-4" /> {t("newServiceRequest")}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("quoteNumberLabel")}</label>
              <input value={form.quoteNumber} onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })} className="field font-mono-en" placeholder="HX-..." />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("newServiceRequest")}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="field">
                <option value="maintenance">{t("typeMaintenance")}</option>
                <option value="return">{t("typeReturn")}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={submit} disabled={saving || !form.quoteNumber.trim()} className="w-full inline-flex items-center justify-center gap-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white h-11 rounded-lg text-sm font-bold disabled:opacity-40">
                <Check className="w-4 h-4" /> {t("addService")}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("serviceReason")}</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="field-textarea" rows={2} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["open", "scheduled", "resolved", "all"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn("px-3 h-9 rounded-lg text-xs font-bold border transition-colors",
              filter === k ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
            {k === "all" ? t("allRequests") : t(STATUS_KEY[k])}
          </button>
        ))}
      </div>

      {rows === null ? (
        <CardsSkeleton count={3} />
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <LifeBuoy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-500">{t("noServiceRequests")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const tel = `${r.quotation.customer.phoneCode}${r.quotation.customer.phone}`;
            return (
              <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{r.quotation.customer.name}</h3>
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", r.type === "return" ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300" : "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300")}>
                        {r.type === "return" ? t("typeReturn") : t("typeMaintenance")}
                      </span>
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", STATUS_TONE[r.status])}>{t(STATUS_KEY[r.status])}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      <MapPin className="w-3 h-3" /> {r.quotation.customer.governorate} — {r.quotation.customer.wilayat}
                      <span className="mx-1">·</span><span className="font-mono-en">{r.quotation.quoteNumber}</span>
                      <span className="mx-1">·</span>{t("raisedOn")} <span className="font-mono-en">{fmtDate(r.createdAt)}</span>
                    </p>
                  </div>
                  <span className="text-sm font-mono-en font-semibold text-gray-700 dark:text-gray-200" dir="ltr">{tel}</span>
                </div>

                {r.reason && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap border-r-2 border-gray-200 dark:border-gray-600 pr-2">{r.reason}</p>}

                {(r.scheduledDate || r.technician) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {r.scheduledDate && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> <span className="font-mono-en">{fmtDate(r.scheduledDate)}</span></span>}
                    {r.technician && <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {r.technician}</span>}
                  </div>
                )}

                {schedId === r.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="field w-auto h-9 font-mono-en" />
                    <select value={schedTech} onChange={(e) => setSchedTech(e.target.value)} className="field w-auto h-9 text-xs py-0">
                      <option value="">{t("noTech")}</option>
                      {techs.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <button onClick={saveSched} className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold"><Check className="w-3.5 h-3.5" /> {t("saveAppt")}</button>
                    <button onClick={() => setSchedId(null)} className="px-3 h-9 text-xs font-bold text-gray-500">{t("cancel")}</button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Link href={`/quotations/${r.quotation.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:underline"><FileText className="w-3.5 h-3.5" /> {t("openOriginalQuote")}</Link>
                  <div className="flex items-center gap-2">
                    <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold"><Phone className="w-3.5 h-3.5" /> {t("callAction")}</a>
                    {r.status !== "resolved" ? (
                      <>
                        <button onClick={() => openSched(r)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><CalendarDays className="w-3.5 h-3.5" /> {t("scheduleVisit")}</button>
                        <button onClick={() => patch(r.id, { status: "resolved" })} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"><Check className="w-3.5 h-3.5" /> {t("markResolved")}</button>
                      </>
                    ) : (
                      <button onClick={() => patch(r.id, { status: "open" })} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold"><RotateCcw className="w-3.5 h-3.5" /> {t("svcOpen")}</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
