"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Check, ChevronDown, ChevronLeft, Plus, X, Trash2, Save, Wand2, Factory, Users, GitBranch, ArrowUp, ArrowDown, Phone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { DateDrillNav, type DateRange } from "@/components/date-drill-nav";

type SpecRow = { labelAr: string; labelEn: string; value: string };
type PTask = { id: string; stage: string; workerId: string | null; workerName: string; workerColor: string; done: boolean };
type PItem = { id: string; categoryId: string; description: string; quantity: number; specs: SpecRow[]; hasPipeline: boolean; tasks: PTask[] };
type PQuote = { id: string; quoteNumber: string; workStatus: string; deliveryDate: string | null; customer: string; customerPhone: string; items: PItem[] };
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

export default function ProductionConsole() {
  const toast = useToast();
  const [data, setData] = useState<ProdFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<"file" | "stations" | "pipelines">("file");

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
      <div className="flex gap-2">
        {([["file", "ملف الإنتاج", Factory], ["stations", "الأقسام", Users], ["pipelines", "المراحل", GitBranch]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setSub(k)}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-bold border transition-colors",
              sub === k ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {sub === "file" && <ProductionFile data={data} reload={load} />}
      {sub === "stations" && <StationsEditor data={data} reload={load} />}
      {sub === "pipelines" && <PipelinesEditor data={data} reload={load} />}
    </div>
  );
}

// ── Production file: spec sheets per quote, plus a by-worker pivot ──

function SpecSheet({ item, onAdvance }: { item: PItem; onAdvance?: (taskId: string) => void }) {
  const current = item.tasks.find((t) => !t.done);
  const allDone = item.tasks.length > 0 && !current;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{item.description}</p>
        {item.quantity > 1 && <span className="text-[11px] font-mono-en font-bold text-gray-400 shrink-0">×{item.quantity}</span>}
      </div>

      {item.specs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {item.specs.map((s, i) => (
            <div key={i} className="rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1">
              <p className="text-[9px] text-gray-400 font-bold">{s.labelAr}</p>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {item.tasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tasks.map((t) => (
            <span key={t.id} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
              t.done ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : t.id === current?.id ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
              {t.done && <Check className="w-3 h-3" />}
              {t.stage}{t.workerName ? ` · ${t.workerName}` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Explicit finish-and-advance control */}
      {onAdvance && item.tasks.length > 0 && (
        allDone ? (
          <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> مكتمل — كل المراحل تمت</p>
        ) : current ? (
          <button onClick={() => onAdvance(current.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
            <Check className="w-3.5 h-3.5" /> أنجز «{current.stage}» وانتقل للتالي
          </button>
        ) : null
      )}
    </div>
  );
}

function ProductionFile({ data, reload }: { data: ProdFile; reload: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"quote" | "worker">("quote");
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string>(data.workers[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<DateRange | null>(null);

  // Filter active quotes by their planned delivery date (the date the work is
  // organised by). "All" (null range) shows everything, including undated.
  const quotes = useMemo(() => {
    if (!range) return data.quotes;
    return data.quotes.filter((q) => q.deliveryDate && q.deliveryDate >= range.from && q.deliveryDate <= range.to);
  }, [range, data.quotes]);

  const apply = async (body: any) => {
    setBusy(true);
    try {
      const res = await fetch("/api/foreman/apply-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast.success(d.created ? `تم إنشاء ${d.created} مرحلة` : "لا جديد — المراحل موجودة"); reload(); }
      else toast.error(d.error || "فشل");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setBusy(false); }
  };

  // Finish the current stage of a piece and advance to the next.
  const advance = async (taskId: string) => {
    try {
      const res = await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, done: true }) });
      if (res.ok) { toast.success("تم — انتقلت للمرحلة التالية"); reload(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "فشل"); }
    } catch { toast.error("تعذّر الاتصال"); }
  };

  // By-worker pivot: items with at least one stage assigned to this worker.
  const workerItems = useMemo(() => {
    if (mode !== "worker" || !workerId) return [];
    const out: { quote: PQuote; item: PItem }[] = [];
    for (const q of quotes) for (const it of q.items) {
      if (it.tasks.some((t) => t.workerId === workerId)) out.push({ quote: q, item: it });
    }
    return out;
  }, [mode, workerId, quotes]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([["quote", "حسب الكوتيشن"], ["worker", "حسب العامل"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border", mode === k ? "bg-teal-600 text-white border-teal-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500")}>
            {l}
          </button>
        ))}
        <span className="ms-auto self-center text-[11px] text-gray-400">كوتيشنات إدارة الأعمال: {quotes.length}</span>
      </div>

      {/* Flexible date filter (year › month › week › day) on the planned date */}
      <DateDrillNav onChange={(r) => setRange(r)} />

      {mode === "quote" && (
        quotes.length === 0 ? <p className="text-sm text-gray-400 p-6 text-center">لا توجد كوتيشنات بهذا التاريخ.</p> : (
          <div className="space-y-2">
            {quotes.map((q) => {
              const open = openQuote === q.id;
              const doneCount = q.items.reduce((a, it) => a + it.tasks.filter((t) => t.done).length, 0);
              const taskCount = q.items.reduce((a, it) => a + it.tasks.length, 0);
              return (
                <div key={q.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <button onClick={() => setOpenQuote(open ? null : q.id)} className="w-full flex items-center gap-2 p-3 text-start hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronLeft className="w-4 h-4 text-gray-400 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{q.customer}</p>
                      <p className="text-[11px] text-gray-400 font-mono-en truncate">{q.quoteNumber}{q.deliveryDate ? ` · ${q.deliveryDate}` : ""}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">{WS_LABEL[q.workStatus || ""] || "—"}</span>
                    <span className="text-[10px] font-mono-en text-gray-400 shrink-0">{q.items.length} صنف</span>
                    {taskCount > 0 && <span className="text-[10px] font-mono-en text-emerald-600 shrink-0">{doneCount}/{taskCount}</span>}
                  </button>
                  {open && (
                    <div className="p-3 pt-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 pb-1">
                        {q.customerPhone && (
                          <a href={`tel:${q.customerPhone}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600"><Phone className="w-3 h-3" /> {q.customerPhone}</a>
                        )}
                        <Link href={`/quotations/${q.id}`} target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <ExternalLink className="w-3.5 h-3.5" /> فتح الكوتيشن كامل
                        </Link>
                        <button disabled={busy} onClick={() => apply({ quotationId: q.id })}
                          className="ms-auto inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                          <Wand2 className="w-3.5 h-3.5" /> تطبيق مراحل الأقسام على الكل
                        </button>
                      </div>
                      {q.items.map((it) => (
                        <div key={it.id} className="space-y-1">
                          <SpecSheet item={it} onAdvance={advance} />
                          {!it.hasPipeline && (
                            <button disabled={busy} onClick={() => apply({ quoteItemId: it.id })}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline disabled:opacity-50">
                              <Plus className="w-3 h-3" /> أنشئ مراحل هذا الصنف
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {mode === "worker" && (
        <div className="space-y-3">
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="field w-full max-w-xs">
            {data.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {workerItems.length === 0 ? <p className="text-sm text-gray-400 p-6 text-center">لا مهام مسندة لهذا العامل في الكوتيشنات الجارية.</p> : (
            <div className="space-y-2">
              {workerItems.map(({ quote, item }) => (
                <div key={item.id} className="space-y-1">
                  <Link href={`/quotations/${quote.id}`} target="_blank" className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-teal-600 font-mono-en">
                    {quote.quoteNumber} · {quote.customer} <ExternalLink className="w-3 h-3" />
                  </Link>
                  <SpecSheet item={item} onAdvance={advance} />
                </div>
              ))}
            </div>
          )}
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
