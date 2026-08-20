"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { ChevronRight, ChevronLeft, Search, Plus, Trash2, Loader2, Truck, Phone, Calendar } from "lucide-react";

interface Entry {
  id: string; quoteNumber: string; customerName: string; phone: string; phoneCode: string;
  governorate: string; wilayat: string; address: string; region: string;
  deliveryDate: string | null; deliveryTime: string; deliveryStatus: string; workNotes: string;
  status: string; itemCount: number; total: number; advanceAmount: number; paid: number; remaining: number;
}
interface SearchResult { id: string; quoteNumber: string; onDeliveryBoard: boolean; customerName: string; phone: string; phoneCode: string; total: number; deliveryDate: string | null; }

const STATUS_OPTS = ["", "booked", "contacted", "delivered", "notified"] as const;

export default function DeliveryBoardPage() {
  const { t, dateLocale } = useI18n();
  const toast = useToast();

  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [canEdit, setCanEdit] = useState(false);
  const [scheduled, setScheduled] = useState<Entry[]>([]);
  const [unscheduled, setUnscheduled] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const fmt = (n: number) => `${(n || 0).toFixed(3)} ر.ع`;

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery-board?month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCanEdit(!!d.canEdit); setScheduled(d.scheduled || []); setUnscheduled(d.unscheduled || []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const h = setTimeout(() => {
      setSearching(true);
      fetch(`/api/delivery-board?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setResults(d?.results || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/delivery-board/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { load(); return true; }
    const e = await res.json().catch(() => ({})); toast.error(e.error || "تعذّر الحفظ"); return false;
  };
  const addToBoard = async (id: string) => { if (await patch(id, { onDeliveryBoard: true })) { setQ(""); setResults([]); toast.success(t("dbAdded")); } };
  const removeFromBoard = async (id: string) => { if (confirm(t("dbRemoveConfirm"))) await patch(id, { onDeliveryBoard: false }); };

  const shiftMonth = (delta: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const monthLabel = useMemo(() => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(dateLocale, { month: "long", year: "numeric" }); }, [month, dateLocale]);

  const groups = useMemo(() => {
    const g: Record<string, Entry[]> = {};
    for (const e of scheduled) { const key = (e.deliveryDate || "").slice(0, 10); (g[key] = g[key] || []).push(e); }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [scheduled]);

  const statusLabel = (s: string) => ({ booked: t("dbStBooked"), contacted: t("dbStContacted"), delivered: t("dbStDelivered"), notified: t("dbStNotified") } as Record<string, string>)[s] || t("dbStNone");
  const statusColor = (s: string) => ({ booked: "bg-blue-100 text-blue-700", contacted: "bg-amber-100 text-amber-700", delivered: "bg-[#eef0ea] text-[#4a5740]", notified: "bg-purple-100 text-purple-700" } as Record<string, string>)[s] || "bg-gray-100 text-gray-500";

  const payBadge = (e: Entry) => {
    if (e.paid >= e.total - 0.0005 && e.total > 0) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#eef0ea] text-[#4a5740]">{t("dbPaid")}</span>;
    if (e.paid > 0) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t("dbPartial")}</span>;
    return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t("dbUnpaid")}</span>;
  };

  const dayHeader = (iso: string) => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "short" }); };

  const EntryRow = ({ e }: { e: Entry }) => {
    const open = expanded === e.id;
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
        <button onClick={() => setExpanded(open ? null : e.id)} className="w-full flex items-center gap-3 p-3 text-right hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{e.customerName}</span>
              <span className="font-mono-en text-xs text-gray-400">{e.quoteNumber}</span>
              {payBadge(e)}
              {e.deliveryStatus && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusColor(e.deliveryStatus)}`}>{statusLabel(e.deliveryStatus)}</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
              <span>{e.region}</span>
              {e.deliveryTime && <span className="font-mono-en">{e.deliveryTime}</span>}
              <span className="font-mono-en font-semibold text-[#6f7e62]">{t("dbRemaining")}: {fmt(e.remaining)}</span>
            </div>
          </div>
          <ChevronLeft className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${open ? "-rotate-90" : ""}`} />
        </button>

        {open && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3 bg-gray-50/60 dark:bg-gray-900/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Info label={t("dbTotal")} value={fmt(e.total)} mono />
              <Info label={t("dbPaidAmount")} value={fmt(e.paid)} mono />
              <Info label={t("dbRemaining")} value={fmt(e.remaining)} mono />
              <Info label={t("advancePayment")} value={fmt(e.advanceAmount)} mono />
              <Info label={t("dbRegion")} value={`${e.governorate} – ${e.wilayat}`} />
              <a href={`https://wa.me/${(e.phoneCode + e.phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="block">
                <span className="text-[11px] text-gray-400 block">الهاتف</span>
                <span className="font-mono-en font-semibold text-[#6f7e62] flex items-center gap-1"><Phone className="w-3 h-3" />{e.phoneCode} {e.phone}</span>
              </a>
              <a href={`/quotations/${e.id}`} className="block">
                <span className="text-[11px] text-gray-400 block">الكوتيشن</span>
                <span className="font-semibold text-blue-600 underline">فتح الكوتيشن ({e.itemCount})</span>
              </a>
            </div>

            {canEdit ? (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 block mb-1">{t("deliveryDate")}</span>
                  <input type="date" className="field font-mono-en" defaultValue={e.deliveryDate ? e.deliveryDate.slice(0, 10) : ""}
                    onChange={(ev) => patch(e.id, { deliveryDate: ev.target.value || null })} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 block mb-1">{t("deliveryTimeLabel") || "الوقت"}</span>
                  <input type="time" className="field font-mono-en" defaultValue={e.deliveryTime}
                    onChange={(ev) => patch(e.id, { deliveryTime: ev.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 block mb-1">{t("dbDeliveryStatus")}</span>
                  <select className="field" defaultValue={e.deliveryStatus} onChange={(ev) => patch(e.id, { deliveryStatus: ev.target.value })}>
                    {STATUS_OPTS.map((s) => <option key={s} value={s}>{s ? statusLabel(s) : t("dbStNone")}</option>)}
                  </select>
                </label>
                <label className="block sm:col-span-3">
                  <span className="text-[11px] font-bold text-gray-500 block mb-1">{t("dbNote")}</span>
                  <textarea rows={2} className="field" defaultValue={e.workNotes}
                    onBlur={(ev) => { if (ev.target.value !== e.workNotes) patch(e.id, { workNotes: ev.target.value }); }} />
                </label>
                <button onClick={() => removeFromBoard(e.id)} className="justify-self-start flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" /> {t("dbRemove")}
                </button>
              </div>
            ) : (
              e.workNotes ? <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm"><span className="text-[11px] font-bold text-gray-500 block">{t("dbNote")}</span>{e.workNotes}</div> : null
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-4">
        <Truck className="w-6 h-6 text-[#6f7e62]" />
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">{t("dbTitle")}</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4 mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
        <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight className="w-5 h-5" /></button>
        <span className="font-bold text-gray-900 dark:text-gray-100 min-w-[140px] text-center flex items-center justify-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft className="w-5 h-5" /></button>
      </div>

      {/* Search / add (editor only) */}
      {canEdit ? (
        <div className="relative mb-5">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("dbSearchAdd")}
              className="flex-1 bg-transparent py-3 text-sm outline-none" />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {results.length > 0 && (
            <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{r.customerName} <span className="font-mono-en text-xs text-gray-400">{r.quoteNumber}</span></div>
                    <div className="text-xs text-gray-400 font-mono-en">{r.phoneCode} {r.phone} · {fmt(r.total)}</div>
                  </div>
                  {r.onDeliveryBoard
                    ? <span className="text-[11px] font-bold text-[#6f7e62] px-2">{t("dbAdded")} ✓</span>
                    : <button onClick={() => addToBoard(r.id)} className="shrink-0 flex items-center gap-1 text-sm font-bold text-white bg-[#8b9a7b] hover:bg-[#6f7e62] px-3 py-1.5 rounded-lg"><Plus className="w-4 h-4" />{t("dbAdd")}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-5 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg py-2">{t("dbViewOnly")}</div>
      )}

      {/* Board */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : (scheduled.length === 0 && unscheduled.length === 0) ? (
        <div className="text-center text-gray-400 py-16">{t("dbNoEntries")}</div>
      ) : (
        <div className="space-y-6">
          {groups.map(([iso, list]) => (
            <div key={iso}>
              <div className="flex items-center gap-2 mb-2 sticky top-0 z-10 py-1">
                <span className="w-1.5 h-5 rounded bg-[#8b9a7b]" />
                <span className="font-bold text-gray-800 dark:text-gray-200">{dayHeader(iso)}</span>
                <span className="text-xs text-gray-400">({list.length})</span>
              </div>
              <div className="space-y-2">{list.map((e) => <EntryRow key={e.id} e={e} />)}</div>
            </div>
          ))}

          {unscheduled.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-5 rounded bg-gray-300" />
                <span className="font-bold text-gray-500">{t("dbUnscheduled")}</span>
                <span className="text-xs text-gray-400">({unscheduled.length})</span>
              </div>
              <div className="space-y-2">{unscheduled.map((e) => <EntryRow key={e.id} e={e} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[11px] text-gray-400 block">{label}</span>
      <span className={`font-semibold text-gray-800 dark:text-gray-200 ${mono ? "font-mono-en" : ""}`}>{value}</span>
    </div>
  );
}
