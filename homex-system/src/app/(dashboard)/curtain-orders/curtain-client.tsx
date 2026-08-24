"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { Blinds, Loader2, TrendingUp, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { CURTAIN_WORK_STATUSES } from "@/lib/curtain-orders";

interface Entry {
  id: string; kind: "quote" | "standalone"; quotationId: string | null; quoteNumber: string;
  customerName: string; phone: string; phoneCode: string; region: string;
  deliveryDate: string | null; status: string; curtainCount: number; curtainTotal: number;
  advanceBillNo: string; ourPrice: number; ourPriceOverridden: boolean;
  outsidePrice: number; difference: number; manufacturer: string; workStatus: string;
}
interface Summary { count: number; totalOur: number; totalOutside: number; totalProfit: number; totalCurtains: number; }

const STATUS_LABEL_KEYS: Record<string, string> = {
  placed: "coStPlaced", awaiting: "coStAwaiting", manufacturing: "coStManufacturing",
  completed: "coStCompleted", ready: "coStReady", delivered: "coStDelivered",
};
const STATUS_COLOR: Record<string, string> = {
  placed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  awaiting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  manufacturing: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  ready: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

export default function CurtainOrdersClient() {
  const { t, dateLocale } = useI18n();
  const toast = useToast();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  // Owners (Riyad / Salim) see the one-time "import Sultan Al Nabhani list" button.
  const [isOwner, setIsOwner] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetch("/api/me").then((r) => r.ok ? r.json() : {}).then((u: any) => {
      setIsOwner(u?.civilId === "2016" || u?.civilId === "1389");
    }).catch(() => {});
  }, []);

  const fmt = (n: number) => (n || 0).toFixed(3);
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/curtain-orders?workStatus=${statusFilter}` : "/api/curtain-orders";
      const res = await fetch(url);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "تعذّر التحميل"); return; }
      setEntries(d.entries || []);
      setManufacturers(d.manufacturers || []);
      setSummary(d.summary || null);
    } finally { setLoading(false); }
  }, [statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (id: string, patch: Record<string, unknown>) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/curtain-orders/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "تعذّر الحفظ"); await load(); return; }
      await load();
    } finally { setSavingId(null); }
  };

  const removeStandalone = async (id: string) => {
    if (!confirm(t("coDeleteConfirm"))) return;
    const res = await fetch(`/api/curtain-orders/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error || "تعذّر الحذف"); return; }
    await load();
  };

  const seedNabhani = async () => {
    if (!confirm("إضافة قائمة سلطان النبهاني (12 طلب) كطلبات مستقلة؟ يحذف أي محاولة سابقة لنفس السندات ويضيفهم من جديد.")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/curtain-orders/seed", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "تعذّرت الإضافة"); return; }
      toast.success(`تمت إضافة ${d.added || 0} طلب${d.removedFirst ? ` (حُذف ${d.removedFirst} قديم)` : ""}`);
      await load();
    } finally { setSeeding(false); }
  };

  const addManual = async () => {
    const res = await fetch("/api/curtain-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: "", phoneCode: "+968", workStatus: "placed" }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error || "تعذّر الإضافة"); return; }
    await load();
  };

  // Local, uncommitted edits so typing feels instant; committed on blur / change.
  const [draft, setDraft] = useState<Record<string, Partial<Entry>>>({});
  const val = (e: Entry, k: keyof Entry): any => (draft[e.id]?.[k] ?? e[k]);
  const setDraftVal = (id: string, k: keyof Entry, v: any) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: v } }));
  const clearDraft = (id: string, k: keyof Entry) =>
    setDraft((d) => { const row = { ...d[id] }; delete row[k]; return { ...d, [id]: row }; });

  const inputCls = "w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-transparent text-xs outline-none focus:border-[#6f7e62]";

  return (
    <div className="max-w-full mx-auto pb-10">
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <Blinds className="w-6 h-6 text-[#6f7e62]" />
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">{t("coTitle")}</h1>
        <div className="flex-1" />
        {isOwner && (
          <button onClick={seedNabhani} disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-[#6f7e62] text-white hover:opacity-90 disabled:opacity-50">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} استيراد قائمة سلطان النبهاني
          </button>
        )}
        <button onClick={addManual} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><Plus className="w-4 h-4" /> {t("coAddManual")}</button>
        <a href="/api/curtain-orders/export" className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700"><FileSpreadsheet className="w-4 h-4" /> {t("coExport")}</a>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold bg-white dark:bg-gray-800">
          <option value="">{t("coAllStatuses")}</option>
          {CURTAIN_WORK_STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABEL_KEYS[s] as any)}</option>)}
        </select>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t("coSubtitle")}</p>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 text-xs font-bold mb-1"><TrendingUp className="w-3.5 h-3.5" /> {t("coSumProfit")}</div>
            <div className="text-lg font-black text-green-700 dark:text-green-300">{fmt(summary.totalProfit)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3"><div className="text-xs font-bold text-gray-500 mb-1">{t("coSumOur")}</div><div className="text-lg font-black text-gray-900 dark:text-gray-100">{fmt(summary.totalOur)}</div></div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3"><div className="text-xs font-bold text-gray-500 mb-1">{t("coSumOutside")}</div><div className="text-lg font-black text-gray-900 dark:text-gray-100">{fmt(summary.totalOutside)}</div></div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3"><div className="text-xs font-bold text-gray-500 mb-1">{t("coSumCount")}</div><div className="text-lg font-black text-gray-900 dark:text-gray-100">{summary.count}</div></div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3"><div className="text-xs font-bold text-gray-500 mb-1">{t("coSumCurtains")}</div><div className="text-lg font-black text-gray-900 dark:text-gray-100">{summary.totalCurtains}</div></div>
        </div>
      )}

      <datalist id="co-manufacturers">{manufacturers.map((m) => <option key={m} value={m} />)}</datalist>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">{t("coNoEntries")}</div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <table className="w-full text-sm border-collapse min-w-[1160px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 text-xs">
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center w-10">{t("coColNo")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-start">{t("coColCustomer")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColDate")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-start">{t("coColPhone")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-start">{t("coColPlace")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColCount")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColBill")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColOur")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColOutside")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColDiff")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-start">{t("coColManufacturer")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 text-center">{t("coColStatus")}</th>
                <th className="p-2 border-b border-gray-200 dark:border-gray-700 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const ourVal = Number(val(e, "ourPrice"));
                const outVal = Number(val(e, "outsidePrice"));
                const diff = (isFinite(ourVal) ? ourVal : 0) - (isFinite(outVal) ? outVal : 0);
                const std = e.kind === "standalone";
                return (
                  <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                    <td className="p-2 text-center text-gray-400">{i + 1}</td>
                    <td className="p-2">
                      {std ? (
                        <input value={val(e, "customerName") ?? ""} onChange={(ev) => setDraftVal(e.id, "customerName", ev.target.value)}
                          onBlur={(ev) => { clearDraft(e.id, "customerName"); if (ev.target.value !== e.customerName) save(e.id, { customerName: ev.target.value }); }}
                          placeholder={t("coColCustomer")} className={inputCls + " font-bold"} />
                      ) : (
                        <><a href={`/quotations/${e.id}`} className="font-bold text-gray-900 dark:text-gray-100 hover:text-[#6f7e62]">{e.customerName || "—"}</a>
                        <div className="text-[11px] text-gray-400">{e.quoteNumber}</div></>
                      )}
                      {std && <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{t("coBadgeStandalone")}</span>}
                    </td>
                    <td className="p-2 text-center whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {std ? (
                        <input type="date" value={toDateInput(val(e, "deliveryDate"))} onChange={(ev) => save(e.id, { deliveryDate: ev.target.value || null })} className={inputCls + " text-center"} />
                      ) : fmtDate(e.deliveryDate)}
                    </td>
                    <td className="p-2 whitespace-nowrap text-gray-700 dark:text-gray-300" dir="ltr">
                      {std ? (
                        <input value={val(e, "phone") ?? ""} onChange={(ev) => setDraftVal(e.id, "phone", ev.target.value)}
                          onBlur={(ev) => { clearDraft(e.id, "phone"); if (ev.target.value !== e.phone) save(e.id, { phone: ev.target.value }); }}
                          placeholder="9xxxxxxx" className={inputCls + " text-center w-28"} />
                      ) : (e.phone ? `${e.phoneCode || ""}${e.phone}` : "—")}
                    </td>
                    <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[180px]">
                      {std ? (
                        <input value={val(e, "region") ?? ""} onChange={(ev) => setDraftVal(e.id, "region", ev.target.value)}
                          onBlur={(ev) => { clearDraft(e.id, "region"); if (ev.target.value !== e.region) save(e.id, { region: ev.target.value }); }}
                          placeholder={t("coColPlace")} className={inputCls + " w-32"} />
                      ) : (<span className="truncate block" title={e.region}>{e.region || "—"}</span>)}
                    </td>
                    <td className="p-2 text-center text-gray-700 dark:text-gray-300">
                      {std ? (
                        <input type="number" min="0" value={val(e, "curtainCount") ?? ""} onChange={(ev) => setDraftVal(e.id, "curtainCount", ev.target.value)}
                          onBlur={(ev) => { clearDraft(e.id, "curtainCount"); const n = ev.target.value === "" ? 0 : parseInt(ev.target.value, 10); if (n !== e.curtainCount) save(e.id, { curtainCount: n }); }}
                          className={inputCls + " text-center w-16"} />
                      ) : (e.curtainCount || "—")}
                    </td>
                    <td className="p-2">
                      <input value={val(e, "advanceBillNo") ?? ""} onChange={(ev) => setDraftVal(e.id, "advanceBillNo", ev.target.value)}
                        onBlur={(ev) => { clearDraft(e.id, "advanceBillNo"); if (ev.target.value !== e.advanceBillNo) save(e.id, { advanceBillNo: ev.target.value }); }}
                        placeholder="SW-000" className={inputCls + " text-center w-24"} />
                    </td>
                    <td className="p-2">
                      <input type="number" step="0.001" min="0" value={val(e, "ourPrice") ?? ""} onChange={(ev) => setDraftVal(e.id, "ourPrice", ev.target.value)}
                        onBlur={(ev) => { clearDraft(e.id, "ourPrice"); const n = ev.target.value === "" ? null : Number(ev.target.value); const cur = e.ourPriceOverridden ? e.ourPrice : (std ? e.ourPrice : null); if (n !== cur) save(e.id, { ourPrice: n }); }}
                        placeholder={fmt(e.curtainTotal)} className={`${inputCls} text-center w-24 ${e.ourPriceOverridden ? "" : "border-dashed text-gray-500"}`} />
                    </td>
                    <td className="p-2">
                      <input type="number" step="0.001" min="0" value={val(e, "outsidePrice") ?? ""} onChange={(ev) => setDraftVal(e.id, "outsidePrice", ev.target.value)}
                        onBlur={(ev) => { clearDraft(e.id, "outsidePrice"); const n = Number(ev.target.value || 0); if (n !== e.outsidePrice) save(e.id, { outsidePrice: n }); }}
                        placeholder="0.000" className={inputCls + " text-center w-24"} />
                    </td>
                    <td className="p-2 text-center whitespace-nowrap">
                      <span className={`font-black ${diff > 0 ? "text-green-600 dark:text-green-400" : diff < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>{fmt(diff)}</span>
                    </td>
                    <td className="p-2">
                      <input list="co-manufacturers" value={val(e, "manufacturer") ?? ""} onChange={(ev) => setDraftVal(e.id, "manufacturer", ev.target.value)}
                        onBlur={(ev) => { clearDraft(e.id, "manufacturer"); if (ev.target.value !== e.manufacturer) save(e.id, { manufacturer: ev.target.value }); }}
                        placeholder={t("coManufacturerPlaceholder")} className={inputCls + " w-32"} />
                    </td>
                    <td className="p-2 text-center">
                      <select value={e.workStatus} onChange={(ev) => save(e.id, { workStatus: ev.target.value })}
                        className={`px-2 py-1 rounded-full text-xs font-bold border-0 outline-none cursor-pointer ${STATUS_COLOR[e.workStatus] || STATUS_COLOR.placed}`}>
                        {CURTAIN_WORK_STATUSES.map((s) => <option key={s} value={s} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">{t(STATUS_LABEL_KEYS[s] as any)}</option>)}
                      </select>
                      {savingId === e.id && <Loader2 className="w-3 h-3 animate-spin inline-block ms-1 text-gray-400" />}
                    </td>
                    <td className="p-2 text-center">
                      {std && <button onClick={() => removeStandalone(e.id)} title={t("coDelete")} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
