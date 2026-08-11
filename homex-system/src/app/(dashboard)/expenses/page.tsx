"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useToast } from "@/components/toast";

interface Expense {
  id: string;
  amount: number;
  category: string;
  note: string | null;
  spentAt: string;
  creator?: { name: string };
}

const CATEGORIES = ["materials", "labor", "rent", "utilities", "transport", "other"] as const;
const CAT_KEY: Record<string, TranslationKey> = {
  materials: "expCatMaterials", labor: "expCatLabor", rent: "expCatRent",
  utilities: "expCatUtilities", transport: "expCatTransport", other: "expCatOther",
};
const CAT_TONE: Record<string, string> = {
  materials: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  labor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  rent: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  utilities: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  transport: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const todayISO = () => new Date().toISOString().split("T")[0];

export default function ExpensesPage() {
  const { t, dateLocale } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [period, setPeriod] = useState("month");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("materials");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    fetch(`/api/expenses?period=${period}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const total = (rows || []).reduce((s, e) => s + e.amount, 0);
  const fmt = (n: number) => `${n.toFixed(3)} ${t("omr")}`;

  const add = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error(t("expAmount")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, category, note, spentAt: date }),
      });
      if (res.ok) {
        toast.success(t("savedSuccess"));
        setAmount(""); setNote("");
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("saveFailed"));
      }
    } catch { toast.error(t("serverConnectionError")); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm(t("expConfirmDelete"))) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) { setRows((p) => (p || []).filter((e) => e.id !== id)); }
      else toast.error(t("errorOccurred"));
    } catch { toast.error(t("errorOccurred")); }
    finally { setBusy(null); }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> {t("expTitle")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("expSubtitle")}</p>
      </div>

      {/* Add form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{t("expAmount")}</label>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="field font-mono-en w-full" placeholder="0.000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{t("expCategory")}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field w-full">
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(CAT_KEY[c])}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{t("expDate")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field font-mono-en w-full" />
          </div>
          <div className="flex items-end">
            <button onClick={add} disabled={saving || !amount}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("expSave")}
            </button>
          </div>
        </div>
        <div className="mt-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field w-full" placeholder={t("expNote")} />
        </div>
      </div>

      {/* Period filter + total */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
          {([["month", "monthPeriod"], ["year", "yearPeriod"], ["all", "allRequests"]] as const).map(([k, lk]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={cn("px-3 py-1.5 rounded text-sm font-bold transition-colors",
                period === k ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white" : "text-gray-500")}>
              {t(lk as TranslationKey)}
            </button>
          ))}
        </div>
        <div className="text-sm font-bold">
          {t("expTotal")}: <span className="font-mono-en text-red-600 dark:text-red-400">{fmt(total)}</span>
        </div>
      </div>

      {/* List */}
      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" /> {t("expNone")}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", CAT_TONE[e.category] || CAT_TONE.other)}>{t(CAT_KEY[e.category] || "expCatOther")}</span>
                  <span className="text-xs text-gray-400 font-mono-en">{new Date(e.spentAt).toLocaleDateString(dateLocale)}</span>
                </div>
                {e.note && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">{e.note}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono-en font-black">{fmt(e.amount)}</span>
                <button onClick={() => remove(e.id)} disabled={busy === e.id}
                  className="p-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50">
                  {busy === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
