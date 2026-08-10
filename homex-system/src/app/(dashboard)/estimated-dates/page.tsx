"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/toast";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";

interface Row {
  id: string;
  quoteNumber: string;
  originalNumber: string | null;
  customerName: string;
  place: string;
  deliveryDate: string | null;
  deliveryTime: string | null;
  workStatus: string | null;
}

const isoDay = (s: string | null) => (s ? new Date(s).toISOString().split("T")[0] : "");

export default function EstimatedDatesPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");

  const load = () => {
    setLoading(true);
    fetch("/api/estimated-dates")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        const items: Row[] = d.items || [];
        setRows(items);
        setDates(Object.fromEntries(items.map((r) => [r.id, isoDay(r.deliveryDate)])));
        setTimes(Object.fromEntries(items.map((r) => [r.id, r.deliveryTime || ""])));
      })
      .catch(() => toast.error(t("edLoadFail")))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async (id: string) => {
    const date = dates[id];
    if (!date) { toast.error(t("edEnterDate")); return; }
    setBusy(id);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryDate: date, deliveryTime: times[id] || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t("wkSaveFailed")); return; }
      toast.success(t("edConfirmed"));
      setRows((prev) => prev.filter((r) => r.id !== id)); // confirmed → leaves the list
    } catch { toast.error(t("wkSaveError")); }
    finally { setBusy(""); }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="w-6 h-6" /> {t("edTitle")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("edSubtitle")}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> {t("loadingDots")}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-semibold">{t("edAllConfirmed")}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-3"><span className="font-mono-en font-bold">{rows.length}</span> {t("edNeedConfirm")}</p>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/quotations/${r.id}`} className="font-mono-en font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{r.quoteNumber}</Link>
                    {r.originalNumber && <span className="text-[10px] font-mono-en px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{t("edRef")}: {r.originalNumber}</span>}
                    <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{t("edEstimated")}</span>
                  </div>
                  <p className="text-sm font-bold mt-0.5 truncate">{displayName(r.customerName, locale)}</p>
                  <p className="text-xs text-gray-400 truncate">{r.place}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input type="date" value={dates[r.id] || ""} onChange={(e) => setDates({ ...dates, [r.id]: e.target.value })}
                    className="field h-10 font-mono-en text-sm" />
                  <input type="time" value={times[r.id] || ""} onChange={(e) => setTimes({ ...times, [r.id]: e.target.value })}
                    className="field h-10 w-24 font-mono-en text-sm" aria-label={t("edTime")} />
                  <button onClick={() => confirm(r.id)} disabled={busy === r.id || !dates[r.id]}
                    className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50">
                    {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("edConfirm")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> {t("edTapHint")}
          </p>
        </>
      )}
    </div>
  );
}
