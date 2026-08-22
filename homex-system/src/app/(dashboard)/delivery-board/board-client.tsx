"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { ChevronRight, ChevronLeft, Search, Plus, Loader2, Truck, Printer, FileSpreadsheet, X } from "lucide-react";

interface Entry {
  id: string; quoteNumber: string; customerName: string; phone: string; phoneCode: string;
  governorate: string; wilayat: string; address: string; region: string;
  deliveryDate: string | null; deliveryTime: string; deliveryDays: number; deliveryStatus: string; workNotes: string;
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

  // Per-day inline "add a customer to this date"
  const [addDate, setAddDate] = useState<string | null>(null);
  const [addQ, setAddQ] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addDays, setAddDays] = useState(1); // how many consecutive days to add

  // Bulk import (editor only)
  const [importOpen, setImportOpen] = useState(false);
  const [importYear, setImportYear] = useState(() => new Date().getFullYear());
  const [importRows, setImportRows] = useState<any[] | null>(null);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [importBusy, setImportBusy] = useState(false);

  const fmt = (n: number) => (n || 0).toFixed(3);

  const runImport = async (file: File) => {
    setImportBusy(true); setImportRows(null); setImportSummary(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("year", String(importYear));
      const res = await fetch("/api/delivery-board/import", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "تعذّر قراءة الملف"); return; }
      setImportRows(d.rows || []); setImportSummary(d.summary || null);
    } finally { setImportBusy(false); }
  };
  const applyImport = async () => {
    const entries = (importRows || []).filter((r) => r.status === "matched" && r.id).map((r) => ({ id: r.id, date: r.date }));
    if (entries.length === 0) { toast.error("لا يوجد صفوف مطابقة"); return; }
    setImportBusy(true);
    try {
      const res = await fetch("/api/delivery-board/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast.success(`${t("dbImported")}: ${d.applied}`); setImportOpen(false); setImportRows(null); load(); }
      else toast.error(d.error || "تعذّر");
    } finally { setImportBusy(false); }
  };

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

  useEffect(() => {
    if (!addQ.trim()) { setAddResults([]); return; }
    const h = setTimeout(() => {
      setAddSearching(true);
      fetch(`/api/delivery-board?q=${encodeURIComponent(addQ.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setAddResults(d?.results || []))
        .catch(() => setAddResults([]))
        .finally(() => setAddSearching(false));
    }, 300);
    return () => clearTimeout(h);
  }, [addQ]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/delivery-board/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { load(); return true; }
    const e = await res.json().catch(() => ({})); toast.error(e.error || "تعذّر الحفظ"); return false;
  };
  const addToBoard = async (id: string) => { if (await patch(id, { onDeliveryBoard: true })) { setQ(""); setResults([]); toast.success(t("dbAdded")); } };
  const openAdd = (iso: string) => { setAddDate(iso); setAddQ(""); setAddResults([]); setAddDays(1); };
  const addToDate = async (id: string, iso: string) => { if (await patch(id, { onDeliveryBoard: true, deliveryDate: iso, deliveryDays: addDays })) { setAddDate(null); setAddQ(""); setAddResults([]); toast.success(t("dbAdded")); } };
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
    // Each entry occupies `deliveryDays` consecutive days from its start date, so
    // it appears on every covered day within this month (a 2-day install shows
    // on both days).
    for (const e of scheduled) {
      if (!e.deliveryDate) continue;
      const start = new Date(e.deliveryDate); start.setHours(0, 0, 0, 0);
      const span = Math.max(1, e.deliveryDays || 1);
      for (let k = 0; k < span; k++) {
        const d = new Date(start); d.setDate(start.getDate() + k);
        if (d.getFullYear() === y && d.getMonth() === mo - 1) (byDay[d.getDate()] ||= []).push(e);
      }
    }
    const out: { day: number; iso: string; weekday: string; dateLabel: string; list: Entry[] }[] = [];
    for (let day = 1; day <= days; day++) {
      const d = new Date(y, mo - 1, day);
      const iso = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      out.push({ day, iso, weekday: d.toLocaleDateString(dateLocale, { weekday: "long" }), dateLabel: `${day}/${mo}`, list: byDay[day] || [] });
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
        {canEdit && (
          <button onClick={() => { setImportOpen(true); setImportRows(null); setImportSummary(null); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><FileSpreadsheet className="w-4 h-4" /> {t("dbImport")}</button>
        )}
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
                const totalCols = canEdit ? 10 : 9;
                const out: any[] = [];

                if (r.list.length === 0) {
                  out.push(
                    <tr key={r.iso} className={isWeekend ? "bg-gray-50/60 dark:bg-gray-900/20" : ""}>
                      <td className={`${td} font-bold text-gray-500`}>{r.weekday}</td>
                      <td className={`${td} font-mono-en text-gray-400`}>{r.dateLabel}</td>
                      <td className={`${td} text-right ${canEdit ? "cursor-pointer group" : ""}`} colSpan={canEdit ? 8 : 7}
                        onClick={canEdit ? () => openAdd(r.iso) : undefined}>
                        {canEdit && (
                          <span className="text-xs text-gray-300 group-hover:text-[#6f7e62] inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />{t("dbAdd")}</span>
                        )}
                      </td>
                    </tr>
                  );
                } else {
                  r.list.forEach((e, i) => {
                    const pay = payInfo(e);
                    const dDays = Math.max(1, e.deliveryDays || 1);
                    const startMs = new Date(e.deliveryDate as string).setHours(0, 0, 0, 0);
                    const rowMs = new Date(r.iso + "T00:00:00").getTime();
                    const spanIdx = Math.round((rowMs - startMs) / 86400000) + 1;
                    const isStart = spanIdx === 1;
                    out.push(
                    <tr key={e.id + "-" + r.iso} className={isWeekend ? "bg-gray-50/60 dark:bg-gray-900/20" : ""}>
                      {i === 0 && <td className={`${td} font-bold text-gray-600 dark:text-gray-300`} rowSpan={span}>{r.weekday}</td>}
                      {i === 0 && <td className={`${td} font-mono-en text-gray-500`} rowSpan={span}>
                        {r.dateLabel}
                        {canEdit && <button onClick={() => openAdd(r.iso)} title={t("dbAdd")} className="block mx-auto mt-1 text-gray-300 hover:text-[#6f7e62]"><Plus className="w-3.5 h-3.5" /></button>}
                      </td>}
                      <td className={`${td} text-right`}>
                        <a href={`/quotations/${e.id}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-[#6f7e62]">{e.customerName}</a>
                        {dDays > 1 && <span className="ms-1 align-middle text-[9px] font-mono-en font-bold text-white bg-[#8b9a7b] rounded px-1">{spanIdx}/{dDays}</span>}
                        <span className="block text-[11px] text-gray-400 font-mono-en">
                          {e.quoteNumber}{e.deliveryTime ? ` · ${e.deliveryTime}` : ""}
                          {canEdit && isStart && <>
                            {" · "}
                            <select value={dDays} onChange={(ev) => patch(e.id, { deliveryDays: Number(ev.target.value) })}
                              className="bg-transparent text-[#6f7e62] font-bold outline-none cursor-pointer" title={t("dcDurationDays")}>
                              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? "يوم" : "أيام"}</option>)}
                            </select>
                          </>}
                        </span>
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
                }

                if (canEdit && addDate === r.iso) {
                  out.push(
                    <tr key={r.iso + "-add"}>
                      <td colSpan={totalCols} className="p-2 bg-[#f6f6f3] dark:bg-gray-900/40">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Search className="w-4 h-4 text-gray-400 shrink-0" />
                          <input autoFocus value={addQ} onChange={(e) => setAddQ(e.target.value)} placeholder={t("dbSearchAdd")}
                            className="flex-1 min-w-[160px] bg-transparent text-sm outline-none py-1" />
                          {addSearching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-bold text-gray-500">{t("dcDurationDays")}:</span>
                            {[1, 2, 3].map((n) => (
                              <button key={n} onClick={() => setAddDays(n)}
                                className={`w-7 h-7 rounded-lg font-bold border ${addDays === n ? "bg-[#8b9a7b] text-white border-[#8b9a7b]" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>{n}</button>
                            ))}
                            <input type="number" min={1} max={14} value={addDays} onChange={(e) => setAddDays(Math.max(1, Math.min(14, parseInt(e.target.value) || 1)))}
                              className="w-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg py-1 font-mono-en" title={t("dcDurationDays")} />
                          </div>
                          <button onClick={() => setAddDate(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                        {addResults.length > 0 && (
                          <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                            {addResults.map((rr) => (
                              <div key={rr.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                                <div className="flex-1 min-w-0 text-right">
                                  <span className="font-bold">{rr.customerName}</span> <span className="font-mono-en text-xs text-gray-400">{rr.quoteNumber}</span>
                                  <span className="block text-[11px] text-gray-400 font-mono-en">{rr.phoneCode} {rr.phone} · {fmt(rr.total)} ر.ع</span>
                                </div>
                                {rr.onDeliveryBoard && (rr.deliveryDate || "").slice(0, 10) === r.iso
                                  ? <span className="text-[11px] font-bold text-[#6f7e62] px-2">{t("dbAdded")} ✓</span>
                                  : <button onClick={() => addToDate(rr.id, r.iso)} className="shrink-0 flex items-center gap-1 text-xs font-bold text-white bg-[#8b9a7b] hover:bg-[#6f7e62] px-2.5 py-1 rounded-lg"><Plus className="w-3.5 h-3.5" />{t("dbAdd")}</button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }

                return out;
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setImportOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-bold text-lg">{t("dbImportTitle")}</h2>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">{t("dbImportHint")}</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="block text-[11px] font-bold text-gray-500 mb-1">{t("dbYear")}</span>
                  <input type="number" value={importYear} onChange={(e) => setImportYear(parseInt(e.target.value) || importYear)} className="field font-mono-en w-28" />
                </label>
                <label className="flex items-center gap-2 px-4 h-10 rounded-lg bg-[#8b9a7b] hover:bg-[#6f7e62] text-white font-bold text-sm cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4" /> {t("dbChooseFile")}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) runImport(f); e.currentTarget.value = ""; }} />
                </label>
                {importBusy && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
              </div>

              {importSummary && (
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="px-2 py-1 rounded bg-[#eef0ea] text-[#4a5740]">{t("dbMatched")}: {importSummary.matched}</span>
                  {importSummary.ambiguous > 0 && <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">{t("dbAmbiguous")}: {importSummary.ambiguous}</span>}
                  {importSummary.notfound > 0 && <span className="px-2 py-1 rounded bg-red-50 text-red-600">{t("dbNotFound")}: {importSummary.notfound}</span>}
                  {importSummary.nodate > 0 && <span className="px-2 py-1 rounded bg-gray-100 text-gray-500">{t("dbNoDate")}: {importSummary.nodate}</span>}
                </div>
              )}

              {importRows && (
                <div className="max-h-72 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0"><tr>
                      <th className="p-2 text-right">المُدخل</th><th className="p-2 text-right">العميل</th><th className="p-2">الكوتيشن</th><th className="p-2">التاريخ</th><th className="p-2">الحالة</th>
                    </tr></thead>
                    <tbody>
                      {importRows.map((r, i) => (
                        <tr key={i} className="border-t border-gray-50 dark:border-gray-700/50">
                          <td className="p-2 text-right text-gray-500">{r.input}</td>
                          <td className="p-2 text-right font-semibold">{r.customerName || "—"}</td>
                          <td className="p-2 text-center font-mono-en text-gray-400">{r.quoteNumber || "—"}</td>
                          <td className="p-2 text-center font-mono-en">{r.date || "—"}</td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded font-bold ${r.status === "matched" ? "bg-[#eef0ea] text-[#4a5740]" : r.status === "ambiguous" ? "bg-amber-50 text-amber-700" : r.status === "nodate" ? "bg-gray-100 text-gray-500" : "bg-red-50 text-red-600"}`}>
                              {r.status === "matched" ? t("dbMatched") : r.status === "ambiguous" ? t("dbAmbiguous") : r.status === "nodate" ? t("dbNoDate") : t("dbNotFound")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {importRows && importSummary?.matched > 0 && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                <button onClick={applyImport} disabled={importBusy}
                  className="w-full h-11 rounded-xl bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {importBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null} {t("dbApplyBtn")} ({importSummary.matched})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
