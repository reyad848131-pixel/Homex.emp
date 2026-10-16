"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Factory, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveRow { itemId: string; item: string; quoteNumber: string; customer: string; stage: string; worker: string; color: string; sinceMs: number }

function fmtSince(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} د`;
  const h = mins / 60;
  if (h < 24) return `${h.toFixed(0)} س`;
  return `${(h / 24).toFixed(0)} يوم`;
}
// Long time in one stage → amber, very long → red (possible stall).
function toneFor(ms: number): string {
  const h = ms / 3600000;
  if (h >= 72) return "border-red-400 dark:border-red-600";
  if (h >= 24) return "border-amber-400 dark:border-amber-600";
  return "border-gray-200 dark:border-gray-700";
}

export function LiveFloorClient() {
  const [rows, setRows] = useState<LiveRow[] | null>(null);
  const [at, setAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    fetch("/api/foreman/live").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setRows(d.live); setAt(new Date()); } }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // auto-refresh for a wall display
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/foreman" className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><ArrowRight className="w-5 h-5" /></Link>
        <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 grid place-items-center text-teal-600"><Factory className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl font-bold">تحت التنفيذ الآن</h1>
          <p className="text-xs text-gray-400">{rows ? `${rows.length} قطعة قيد العمل` : "…"}{at && ` · آخر تحديث ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}</p>
        </div>
        <button onClick={load} className="ms-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" title="تحديث"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 text-gray-400 p-6"><Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
          <Factory className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          لا توجد قطع تحت التنفيذ حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <Link key={r.itemId} href={`/item/${r.itemId}`} className={cn("rounded-2xl border-2 bg-white dark:bg-gray-800 p-4 block", toneFor(r.sinceMs))}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-lg truncate">{r.item}</span>
                <span className="text-sm font-mono-en font-bold text-gray-400 shrink-0">{fmtSince(r.sinceMs)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{r.quoteNumber} · {r.customer}</div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm font-bold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300">{r.stage}</span>
                <span className="ms-auto flex items-center gap-1.5 text-sm font-semibold">
                  <span className="w-3 h-3 rounded-full" style={{ background: r.color }} /> {r.worker}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
