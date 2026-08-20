"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { ChevronRight, ChevronLeft, Search, Plus, Loader2, Truck, Printer, FileSpreadsheet, X } from "lucide-react";

interface Entry {
  id: string; quoteNumber: string; customerName: string; phone: string; phoneCode: string;
  governorate: string; wilayat: string; address: string; region: string;
  deliveryDate: string | null; deliveryTime: string; deliveryStatus: string; workNotes: string;
  status: string; itemCount: number; total: number; advanceAmount: number; paid: number; remaining: number;
}
interface SearchResult { id: string; quoteNumber: string; onDeliveryBoard: boolean; customerName: string; phone: string; phoneCode: string; total: number; deliveryDate: string | null; }

const STATUS_OPTS = ["", "booked", "contacted", "delivered", "notified"] as const;

export default function DeliveryBoardClient() {
  const { t, dateLocale } = useI18n();
  const toast = useToast();

  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [canEdit, setCanEdit] = useState(false);
  const [scheduled, setScheduled] = useState<Entry[]>([]);
  const [unscheduled, setUnscheduled] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const fmt = (n: number) => (n || 0).toFixed(3);

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

  const statusLabel = (s: string) => ({ booked: t("dbStBooked"), contacted: t("dbStContacted"), delivered: t("dbStDelivered"), notified: t("dbStNotified") } as Record<string, string>)[s] || "—";
  const statusCell = (s: string) => ({ booked: "bg-blue-50 text-blue-700", contacted: "bg-amber-50 text-amber-700", delivered: "bg-[#eef0ea] text-[#4a5740]", notified: "bg-purple-50 text-purple-700" } as Record<string, string>)[s] || "";
  const payInfo = (e: Entry): { label: string; cls: string } => {
    if (e.total > 0 && e.paid >= e.total - 0.0005) return { label: t("dbPaid"), cls: "bg-[#eef0ea] text-[#4a5740]" };
    if (e.paid > 0) return { label: t("dbPartial"), cls: "bg-amber-50 text-amber-700" };
    return { label: t("dbUnpaid"), cls: "bg-red-50 text-red-600" };
  };

  // Build one visual row per day of the month (empty days included), Word-style.
  const rows = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const days = new Date(y, mo, 0).getDate();
    const byDay: Record<number, Entry[]> = {};
    for (const e of scheduled) { if (!e.deliveryDate) continue; const d = new Date(e.deliveryDate); if (d.getFullYear() === y && d.getMonth() === mo - 1) (byDay[d.getDate()] ||= []).push(e); }
    const out: { day: number; weekday: string; dateLabel: string; list: Entry[] }[] = [];
    for (let day = 1; day <= days; day++) {
      const d = new Date(y, mo - 1, day);
      out.push({ day, weekday: d.toLocaleDateString(dateLocale, { weekday: "long" }), dateLabel: `${day}/${mo}`, list: byDay[day] || [] });
    }
    return out;
  }, [month, scheduled, dateLocale]);

  // Inline edit controls for a delivery cell group (editor only).
  const StatusSelect = ({ e }: { e: Entry }) => (
    <select value={e.deliveryStatus} onChange={(ev) => patch(e.id, { deliveryStatus: ev.target.value })}
      className={`w-full text-xs font-bold rounded px-1.5 py-1 border-0 outline-none cursor-pointer ${statusCell(e.deliveryStatus)}`}>
      {STATUS_OPTS.map((s) => <option key={s} value={s}>{s ? statusLabel(s) : "—"}</option>)}
    </select>
  );

  const th = "px-2 py-2 text-xs font-bold text-white text-center whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm text-center align-middle border-b border-gray-100 dark:border-gray-700/60";

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Truck className="w-6 h-6 text-[#6f7e62]" />
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">{t("dbTitle")}</h1>
        <div className="flex-1" />
        <a href={`/api/delivery-board/print?month=${month}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><Printer className="w-4 h-4" /> {t("print")}</a>
        <a href={`/api/delivery-board/export?month=${month}`}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><FileSpreadsheet className="w-4 h-4" /> Excel</a>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4 mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
        <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight className="w-5 h-5" /></button>
        <span className="font-bold text-gray-900 dark:text-gray-100 min-w-[150px] text-center">{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft className="w-5 h-5" /></button>
      </div>

      {/* Search / add (editor only) */}
      {canEdit ? (
        <div className="relative mb-4">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("dbSearchAdd")} className="flex-1 bg-transparent py-3 text-sm outline-none" />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {results.length > 0 && (
            <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{r.customerName} <span className="font-mono-en text-xs text-gray-400">{r.quoteNumber}</span></div>
                    <div className="text-xs text-gray-400 font-mono-en">{r.phoneCode} {r.phone} · {fmt(r.total)} ر.ع</div>
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
        <div className="mb-4 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg py-2">{t("dbViewOnly")}</div>
      )}

      {/* Unscheduled entries (need a date to appear in the table) */}
      {unscheduled.length > 0 && (
        <div className="mb-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3">
          <p className="text-xs font-bold text-gray-500 mb-2">{t("dbUnscheduled")} ({unscheduled.length})</p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((e) => (
              <div key={e.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-2.5 py-1.5 text-sm">
                <span className="font-bold">{e.customerName}</span>
                <span className="font-mono-en text-xs text-gray-400">{e.quoteNumber}</span>
                {canEdit && <input type="date" className="text-xs font-mono-en border rounded px-1 py-0.5 bg-transparent" onChange={(ev) => ev.target.value && patch(e.id, { deliveryDate: ev.target.value })} />}
                {canEdit && <button onClick={() => removeFromBoard(e.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month table (Word-style: a row per day, empty days included) */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="w-full border-collapse min-w-[820px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800">
                <th className={th} style={{ width: 72 }}>اليوم</th>
                <th className={th} style={{ width: 60 }}>التاريخ</th>
                <th className={th}>العميل</th>
                <th className={th}>المنطقة</th>
                <th className={th} style={{ width: 90 }}>المبلغ</th>
                <th className={th} style={{ width: 90 }}>{t("dbRemaining")}</th>
                <th className={th} style={{ width: 84 }}>الدفع</th>
                <th className={th} style={{ width: 120 }}>الحالة</th>
                <th className={th}>ملاحظات</th>
                {canEdit && <th className={th} style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const span = Math.max(1, r.list.length);
                const isWeekend = r.weekday.includes("جمعة");
                if (r.list.length === 0) {
                  return (
                    <tr key={r.day} className={isWeekend ? "bg-gray-50/60 dark:bg-gray-900/20" : ""}>
                      <td className={`${td} font-bold text-gray-500`}>{r.weekday}</td>
                      <td className={`${td} font-mono-en text-gray-400`}>{r.dateLabel}</td>
                      <td className={td} colSpan={canEdit ? 8 : 7}></td>
                    </tr>
                  );
                }
                return r.list.map((e, i) => {
                  const pay = payInfo(e);
                  return (
                    <tr key={e.id} className={isWeekend ? "bg-gray-50/60 dark:bg-gray-900/20" : ""}>
                      {i === 0 && <td className={`${td} font-bold text-gray-600 dark:text-gray-300`} rowSpan={span}>{r.weekday}</td>}
                      {i === 0 && <td className={`${td} font-mono-en text-gray-500`} rowSpan={span}>{r.dateLabel}</td>}
                      <td className={`${td} text-right`}>
                        <a href={`/quotations/${e.id}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-[#6f7e62]">{e.customerName}</a>
                        <span className="block text-[11px] text-gray-400 font-mono-en">{e.quoteNumber}{e.deliveryTime ? ` · ${e.deliveryTime}` : ""}</span>
                      </td>
                      <td className={`${td} text-gray-600 dark:text-gray-300`}>{e.region}</td>
                      <td className={`${td} font-mono-en`}>{fmt(e.total)}</td>
                      <td className={`${td} font-mono-en font-bold text-[#6f7e62]`}>{fmt(e.remaining)}</td>
                      <td className={td}><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pay.cls}`}>{pay.label}</span></td>
                      <td className={td}>
                        {canEdit ? <StatusSelect e={e} /> : (e.deliveryStatus ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusCell(e.deliveryStatus)}`}>{statusLabel(e.deliveryStatus)}</span> : "—")}
                      </td>
                      <td className={`${td} text-right`}>
                        {canEdit
                          ? <input defaultValue={e.workNotes} placeholder="…" onBlur={(ev) => { if (ev.target.value !== e.workNotes) patch(e.id, { workNotes: ev.target.value }); }}
                              className="w-full min-w-[120px] text-sm bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#8b9a7b] outline-none py-0.5" />
                          : <span className="text-gray-600 dark:text-gray-300">{e.workNotes || "—"}</span>}
                      </td>
                      {canEdit && <td className={td}><button onClick={() => removeFromBoard(e.id)} className="text-red-300 hover:text-red-500" title={t("dbRemove")}><X className="w-4 h-4" /></button></td>}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
