"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Loader2, Check, ChevronDown, ChevronLeft, Plus, X, Trash2, Save, Wand2, Factory, Users, GitBranch, ArrowUp, ArrowDown, Phone, ExternalLink, Clock, Camera, ClipboardList, Package, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { DateDrillNav, type DateRange } from "@/components/date-drill-nav";
import { type PItem } from "@/components/production-spec";

type PQuote = { id: string; quoteNumber: string; workStatus: string; deliveryDate: string | null; woodStatus?: string; fabricStatus?: string; customer: string; customerPhone: string; items: PItem[] };
type Worker = { id: string; name: string; color: string };
type Category = { id: string; nameAr: string; nameEn: string };
type Station = { id: string; name: string; mainWorkerId: string | null; subWorkerIds: string[]; mainWorkerName?: string; subNames?: string[] };
type ProdFile = {
  quotes: PQuote[]; workers: Worker[]; categories: Category[];
  stations: Station[]; pipelines: Record<string, string[]>; defaultPipeline: string[];
};

const WS_LABEL: Record<string, string> = {
  needs_preparation: "يحتاج طلب",
  ready_to_execute: "جاهز للتنفيذ",
  in_progress: "قيد التنفيذ",
  ready_for_delivery: "جاهز للتوصيل",
};

export default function ProductionConsole({ isOwner = false }: { isOwner?: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<ProdFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<"file" | "stations" | "pipelines">(() => {
    if (typeof window !== "undefined") { try { const s = sessionStorage.getItem("fm:sub"); if (s === "file" || s === "stations" || s === "pipelines") return s; } catch { /* ignore */ } }
    return "file";
  });
  useEffect(() => { try { sessionStorage.setItem("fm:sub", sub); } catch { /* ignore */ } }, [sub]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/foreman/production");
      if (res.ok) setData(await res.json());
      else toast.error("تعذّر تحميل ملف الإنتاج");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center gap-2 text-gray-400 p-6"><Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* The setup sub-tabs (stations & pipelines) are configured once and shown
          only to owners; the foreman just sees the production file. */}
      {isOwner && (
        <div className="flex gap-2">
          {([["file", "ملف الإنتاج", Factory], ["stations", "الأقسام", Users], ["pipelines", "المراحل", GitBranch]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setSub(k)}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-bold border transition-colors",
                sub === k ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
              <Icon className="w-4 h-4" /> {l}
            </button>
          ))}
        </div>
      )}

      {(!isOwner || sub === "file") && <ProductionFile data={data} />}
      {isOwner && sub === "stations" && <StationsEditor data={data} reload={load} />}
      {isOwner && sub === "pipelines" && <PipelinesEditor data={data} reload={load} />}
    </div>
  );
}

// ── Production file: spec sheets per quote, plus a by-worker pivot ──


function ProductionFile({ data }: { data: ProdFile }) {
  const [range, setRange] = useState<DateRange | null>(null);

  // Restore the saved scroll position once, on returning from a work page.
  useEffect(() => {
    let y = 0;
    try { y = parseInt(sessionStorage.getItem("fm:scroll") || "0", 10) || 0; } catch { /* ignore */ }
    if (y > 0) {
      const r1 = requestAnimationFrame(() => { const r2 = requestAnimationFrame(() => window.scrollTo(0, y)); void r2; });
      return () => cancelAnimationFrame(r1);
    }
  }, []);

  // Filter active quotes by their planned delivery date (the date the work is
  // organised by). "All" (null range) shows everything, including undated.
  const quotes = useMemo(() => {
    if (!range) return data.quotes;
    return data.quotes.filter((q) => q.deliveryDate && q.deliveryDate >= range.from && q.deliveryDate <= range.to);
  }, [range, data.quotes]);

  return (
    <div className="space-y-3">
      <div className="flex">
        <span className="ms-auto self-center text-[11px] text-gray-400">كوتيشنات إدارة الأعمال: {quotes.length}</span>
      </div>

      {/* Flexible date filter (year › month › week › day) on the planned date */}
      <DateDrillNav onChange={(r) => setRange(r)} />

      {quotes.length === 0 ? <p className="text-sm text-gray-400 p-6 text-center">لا توجد كوتيشنات بهذا التاريخ.</p> : (
        <div className="space-y-2">
          {/* Each quote opens its own dedicated WORK PAGE (/project/[id]) with
              all the controls — the list stays light and "back" returns here. */}
          {quotes.map((q) => {
            const doneCount = q.items.reduce((a, it) => a + it.tasks.filter((t) => t.done).length, 0);
            const taskCount = q.items.reduce((a, it) => a + it.tasks.length, 0);
            return (
              <Link key={q.id} href={`/project/${q.id}`}
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{q.customer}</p>
                  <p className="text-[11px] text-gray-400 font-mono-en truncate">{q.quoteNumber}{q.deliveryDate ? ` · ${q.deliveryDate}` : ""}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">{WS_LABEL[q.workStatus || ""] || "—"}</span>
                <span className="text-[10px] font-mono-en text-gray-400 shrink-0">{q.items.length} صنف</span>
                {taskCount > 0 && <span className="text-[10px] font-mono-en text-emerald-600 shrink-0">{doneCount}/{taskCount}</span>}
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 border border-teal-200 dark:border-teal-800 rounded-lg px-2 py-1">
                  صفحة العمل <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Stations editor: sections, each with a main worker + sub-workers ──

function StationsEditor({ data, reload }: { data: ProdFile; reload: () => void }) {
  const toast = useToast();
  const [stations, setStations] = useState<Station[]>(() => data.stations.map((s) => ({ id: s.id, name: s.name, mainWorkerId: s.mainWorkerId, subWorkerIds: [...s.subWorkerIds] })));
  const [saving, setSaving] = useState(false);

  const patch = (i: number, p: Partial<Station>) => setStations((prev) => prev.map((s, idx) => idx === i ? { ...s, ...p } : s));
  const toggleSub = (i: number, wid: string) => {
    const cur = stations[i].subWorkerIds;
    patch(i, { subWorkerIds: cur.includes(wid) ? cur.filter((x) => x !== wid) : [...cur, wid] });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/foreman/config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stations, pipelines: data.pipelines, defaultPipeline: data.defaultPipeline }),
      });
      if (res.ok) { toast.success("تم حفظ الأقسام ✅"); reload(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "فشل الحفظ"); }
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">كل قسم يمسكه عامل رئيسي واحد، وتحته عمّال. اسم القسم هو نفسه اسم المرحلة (مثل: تقطيع، تنجيد، تشطيب) عشان تنربط تلقائياً.</p>
      {stations.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input value={s.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="اسم القسم / المرحلة" className="field flex-1 font-bold" />
            <button onClick={() => setStations((prev) => prev.filter((_, idx) => idx !== i))} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold text-gray-500">العامل الرئيسي (main worker)</span>
            <select value={s.mainWorkerId || ""} onChange={(e) => patch(i, { mainWorkerId: e.target.value || null })} className="field w-full mt-1">
              <option value="">— بدون —</option>
              {data.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <div>
            <span className="text-[11px] font-bold text-gray-500">العمّال تحته</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.workers.filter((w) => w.id !== s.mainWorkerId).map((w) => {
                const on = s.subWorkerIds.includes(w.id);
                return (
                  <button key={w.id} onClick={() => toggleSub(i, w.id)}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", on ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-600" : "border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700")}>
                    {w.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setStations((prev) => [...prev, { id: `st${Date.now().toString(36)}`, name: "", mainWorkerId: null, subWorkerIds: [] }])}
        className="btn-secondary w-full flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> أضف قسم</button>
      <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الأقسام
      </button>
    </div>
  );
}

// ── Pipelines editor: ordered stages per category ──

function StageList({ stages, stationNames, onChange }: { stages: string[]; stationNames: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (v && !stages.includes(v)) onChange([...stages, v]); setDraft(""); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= stages.length) return;
    const next = [...stages]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {stages.length === 0 && <p className="text-[11px] text-gray-400">لا مراحل — ستُستخدم المراحل الافتراضية.</p>}
        {stages.map((st, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/40 rounded-lg px-2 py-1">
            <span className="text-[10px] font-mono-en text-gray-400 w-4 text-center">{i + 1}</span>
            <span className="flex-1 text-sm font-bold">{st}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-gray-400 disabled:opacity-30 hover:text-gray-700"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="p-1 text-gray-400 disabled:opacity-30 hover:text-gray-700"><ArrowDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => onChange(stages.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input list="station-names" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="اسم المرحلة ثم Enter" className="field flex-1" />
        <button onClick={add} className="btn-secondary shrink-0 flex items-center gap-1"><Plus className="w-4 h-4" /></button>
      </div>
      <datalist id="station-names">{stationNames.map((n) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}

function PipelinesEditor({ data, reload }: { data: ProdFile; reload: () => void }) {
  const toast = useToast();
  const [pipelines, setPipelines] = useState<Record<string, string[]>>(() => ({ ...data.pipelines }));
  const [def, setDef] = useState<string[]>([...data.defaultPipeline]);
  const [saving, setSaving] = useState(false);
  const stationNames = data.stations.map((s) => s.name).filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/foreman/config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stations: data.stations, pipelines, defaultPipeline: def }),
      });
      if (res.ok) { toast.success("تم حفظ المراحل ✅"); reload(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "فشل الحفظ"); }
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">مراحل كل قسم بالترتيب. خلّ اسم المرحلة نفس اسم القسم عشان تنسند تلقائياً للعامل الرئيسي.</p>

      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 space-y-2">
        <p className="text-sm font-bold">المراحل الافتراضية <span className="text-[11px] font-normal text-gray-400">(لأي قسم بلا مراحل خاصة)</span></p>
        <StageList stages={def} stationNames={stationNames} onChange={setDef} />
      </div>

      {data.categories.map((c) => (
        <div key={c.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2">
          <p className="text-sm font-bold">{c.nameAr}</p>
          <StageList stages={pipelines[c.id] || []} stationNames={stationNames} onChange={(s) => setPipelines((prev) => ({ ...prev, [c.id]: s }))} />
        </div>
      ))}

      <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ المراحل
      </button>
    </div>
  );
}
