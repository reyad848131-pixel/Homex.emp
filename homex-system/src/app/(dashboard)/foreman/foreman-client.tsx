"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronLeft, Check, X, HardHat, Truck, BarChart3, AlertTriangle, Plus, FileSpreadsheet, Loader2, Factory, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import ProductionConsole from "@/components/foreman-production";

type Task = { id: string; stage: string; workerId: string | null; itemDesc: string; quoteId: string; quoteNumber: string; customer: string };
type WorkerCard = { id: string; name: string; color: string; status: string; note: string; onCrew: boolean; open: Task[]; doneToday: Task[] };
type Install = { quoteId: string; quoteNumber: string; customer: string; location: string; time: string; crewId: string | null; requiredCount: number; notes: string; members: { workerId: string; name: string; color: string }[] };
type Board = { date: string; workers: WorkerCard[]; ready: Task[]; onSiteCount: number; installs: Install[] };

const todayStr = () => new Date().toISOString().slice(0, 10);
const shiftDay = (d: string, n: number) => { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const ATT = [["present", "حاضر"], ["onsite", "بالموقع"], ["absent", "غائب"]] as const;

export default function ForemanClient() {
  const toast = useToast();
  const [tab, setTab] = useState<"production" | "board" | "install" | "reports">("production");
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/foreman?date=${d}`);
      if (res.ok) setData(await res.json());
      else toast.error("تعذّر تحميل البيانات");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(date); }, [date, load]);

  const post = async (url: string, body: any, method = "POST") => {
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "فشل الحفظ"); return null; }
      return res.json().catch(() => ({}));
    } catch { toast.error("تعذّر الاتصال"); return null; }
  };

  const setAttendance = async (workerId: string, status: string) => { await post("/api/foreman/attendance", { workerId, date, status }); load(date); };
  const reassign = async (taskId: string, workerId: string) => { await post("/api/item-tasks", { id: taskId, workerId: workerId || null }, "PATCH"); load(date); };
  const markDone = async (taskId: string) => { await post("/api/item-tasks", { id: taskId, done: true }, "PATCH"); load(date); };

  const ensureCrew = async (job: Install): Promise<string | null> => {
    if (job.crewId) return job.crewId;
    const r = await post("/api/foreman/crew", { quotationId: job.quoteId, date });
    return r?.id || null;
  };
  const setRequired = async (job: Install, n: number) => { await post("/api/foreman/crew", { quotationId: job.quoteId, date, requiredCount: n }); load(date); };
  const setNotes = async (job: Install, notes: string) => { await post("/api/foreman/crew", { quotationId: job.quoteId, date, notes }); };
  const addMember = async (job: Install, workerId: string) => { const id = await ensureCrew(job); if (!id) return; await post("/api/foreman/crew", { crewId: id, add: workerId }, "PATCH"); load(date); };
  const removeMember = async (job: Install, workerId: string) => { if (!job.crewId) return; await post("/api/foreman/crew", { crewId: job.crewId, remove: workerId }, "PATCH"); load(date); };

  const workers = data?.workers || [];
  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("ar-OM", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 grid place-items-center text-teal-600 shrink-0"><HardHat className="w-5 h-5" /></div>
        <h1 className="text-xl font-bold">لوحة الفورمن</h1>
      </div>

      {/* Day navigation — only for the day-scoped tabs */}
      {(tab === "board" || tab === "install") && (
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
        <button onClick={() => setDate(shiftDay(date, -1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight className="w-5 h-5" /></button>
        <div className="flex-1 text-center">
          <p className="text-sm font-bold">{dayLabel}</p>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} className="text-xs text-gray-400 bg-transparent text-center font-mono-en" />
        </div>
        <button onClick={() => setDate(shiftDay(date, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft className="w-5 h-5" /></button>
        {date !== todayStr() && <button onClick={() => setDate(todayStr())} className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold">اليوم</button>}
      </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([["production", "الإنتاج", Factory], ["board", "العمّال", HardHat], ["install", "التركيب", Truck], ["reports", "التقارير", BarChart3]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold border transition-colors",
              tab === k ? "bg-teal-600 text-white border-teal-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {tab === "production" && <ProductionConsole />}

      {loading && tab !== "production" && tab !== "reports" && <div className="flex items-center gap-2 text-gray-400 p-6"><Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…</div>}

      {!loading && tab === "board" && <BoardTab workers={workers} ready={data?.ready || []} onAtt={setAttendance} onReassign={reassign} onDone={markDone} />}
      {!loading && tab === "install" && <InstallTab installs={data?.installs || []} workers={workers} onRequired={setRequired} onNotes={setNotes} onAdd={addMember} onRemove={removeMember} />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}

function StatusPill({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  return (
    <div className="flex gap-1">
      {ATT.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={cn("px-2 py-0.5 rounded text-[11px] font-bold border transition-colors",
            status === k
              ? k === "absent" ? "bg-red-600 text-white border-red-600" : k === "onsite" ? "bg-amber-500 text-white border-amber-500" : "bg-emerald-600 text-white border-emerald-600"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function TaskRow({ task, workers, onReassign, onDone }: { task: Task; workers: WorkerCard[]; onReassign: (id: string, w: string) => void; onDone: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{task.stage} · {task.itemDesc}</p>
        <p className="text-[10px] text-gray-400 font-mono-en truncate">{task.quoteNumber} · {task.customer}</p>
      </div>
      <select value={task.workerId || ""} onChange={(e) => onReassign(task.id, e.target.value)}
        className="text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1 max-w-[90px]">
        <option value="">— بدون —</option>
        {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <button onClick={() => onDone(task.id)} title="تم" className="w-7 h-7 shrink-0 grid place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Check className="w-4 h-4" /></button>
    </div>
  );
}

function BoardTab({ workers, ready, onAtt, onReassign, onDone }: { workers: WorkerCard[]; ready: Task[]; onAtt: (w: string, s: string) => void; onReassign: (id: string, w: string) => void; onDone: (id: string) => void }) {
  const available = workers.filter((w) => w.status === "present" && !w.onCrew && w.open.length === 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold">متاح الحين: {available.length}</span>
        <span className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-bold">بالمواقع: {workers.filter((w) => w.onCrew).length}</span>
        <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold">غائب: {workers.filter((w) => w.status === "absent").length}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {workers.map((w) => (
          <div key={w.id} className={cn("rounded-xl border p-3 space-y-2", w.status === "absent" ? "opacity-60 border-gray-200 dark:border-gray-700" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800")}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: w.color }} />
                <span className="font-bold truncate">{w.name}</span>
                {w.onCrew && <span className="text-[10px] font-bold text-amber-600 shrink-0">بالموقع 🚚</span>}
              </div>
              <StatusPill status={w.status} onChange={(s) => onAtt(w.id, s)} />
            </div>
            {w.status !== "absent" && (
              <>
                {w.open.length === 0 ? (
                  <p className="text-[11px] text-emerald-600 font-bold">متاح — لا مهام مفتوحة</p>
                ) : (
                  <div className="space-y-1.5">{w.open.map((t) => <TaskRow key={t.id} task={t} workers={workers} onReassign={onReassign} onDone={onDone} />)}</div>
                )}
                {w.doneToday.length > 0 && <p className="text-[10px] text-gray-400">أنجز اليوم: <span className="font-bold text-gray-600 dark:text-gray-300">{w.doneToday.length}</span></p>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Ready pool — unassigned work to hand out */}
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3">
        <p className="text-sm font-bold mb-2">مهام بلا عامل ({ready.length})</p>
        {ready.length === 0 ? <p className="text-xs text-gray-400">لا يوجد — كل المهام مسندة.</p> : (
          <div className="space-y-1.5">{ready.map((t) => <TaskRow key={t.id} task={t} workers={workers} onReassign={onReassign} onDone={onDone} />)}</div>
        )}
      </div>
    </div>
  );
}

function InstallTab({ installs, workers, onRequired, onNotes, onAdd, onRemove }: { installs: Install[]; workers: WorkerCard[]; onRequired: (j: Install, n: number) => void; onNotes: (j: Install, s: string) => void; onAdd: (j: Install, w: string) => void; onRemove: (j: Install, w: string) => void }) {
  const outIds = new Set<string>();
  for (const j of installs) for (const m of j.members) outIds.add(m.workerId);
  const inFactory = workers.filter((w) => w.status !== "absent" && !outIds.has(w.id));

  if (installs.length === 0) return <p className="text-sm text-gray-400 p-6 text-center">لا يوجد تركيبات مجدولة لهذا اليوم.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-bold">تركيبات اليوم: {installs.length}</span>
        <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold">باقي بالمصنع: {inFactory.length}</span>
      </div>

      {installs.map((j) => {
        const short = j.members.length < j.requiredCount;
        return (
          <div key={j.quoteId} className={cn("rounded-xl border p-3 space-y-3", short ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold truncate">{j.customer}</p>
                <p className="text-[11px] text-gray-400 font-mono-en truncate">{j.quoteNumber}{j.time ? ` · ${j.time}` : ""}</p>
                {j.location && <p className="text-[11px] text-gray-500 truncate">📍 {j.location}</p>}
              </div>
              <div className="text-center shrink-0">
                <p className="text-[10px] text-gray-400">المطلوب</p>
                <input type="number" min={0} value={j.requiredCount}
                  onChange={(e) => onRequired(j, Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 text-center font-mono-en font-black rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1" />
              </div>
            </div>

            {short && (
              <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4" /> ناقص {j.requiredCount - j.members.length}: الموقع يحتاج {j.requiredCount} واخترت {j.members.length}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {j.members.map((m) => (
                <span key={m.workerId} className="flex items-center gap-1 pl-1 pr-2 py-1 rounded-full text-xs font-bold text-white" style={{ background: m.color }}>
                  {m.name}
                  <button onClick={() => onRemove(j, m.workerId)} className="w-4 h-4 grid place-items-center rounded-full bg-black/20 hover:bg-black/40"><X className="w-3 h-3" /></button>
                </span>
              ))}
              <select value="" onChange={(e) => { if (e.target.value) onAdd(j, e.target.value); }}
                className="text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1">
                <option value="">+ أضف عامل</option>
                {workers.filter((w) => w.status !== "absent" && !j.members.some((m) => m.workerId === w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <input defaultValue={j.notes} onBlur={(e) => { if (e.target.value !== j.notes) onNotes(j, e.target.value); }}
              placeholder="ملاحظات الموقع (اختياري)" className="field text-xs" />
          </div>
        );
      })}
    </div>
  );
}

function ReportsTab() {
  const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<any[] | null>(null);
  const [byStage, setByStage] = useState<{ stage: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<string>("month");

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/foreman/reports?from=${from}&to=${to}`);
      if (res.ok) { const d = await res.json(); setRows(d.rows || []); setByStage(d.byStage || []); }
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { run(); }, [run]);

  // Quick-range presets (rolling week; calendar month/year).
  const applyPreset = (key: string) => {
    setPreset(key);
    const now = new Date();
    const d = (dt: Date) => dt.toISOString().slice(0, 10);
    if (key === "day") { setFrom(todayStr()); setTo(todayStr()); }
    else if (key === "week") { const s = new Date(now); s.setDate(s.getDate() - 6); setFrom(d(s)); setTo(todayStr()); }
    else if (key === "month") { setFrom(d(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(todayStr()); }
    else if (key === "year") { setFrom(d(new Date(now.getFullYear(), 0, 1))); setTo(todayStr()); }
  };

  const printPdf = () => {
    const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
    const workerRows = (rows || []).map((r) => `<tr><td>${esc(r.name)}</td><td>${r.tasksDone}</td><td>${r.installs}</td><td>${r.daysPresent}</td><td>${r.daysAbsent}</td></tr>`).join("");
    const stageRows = byStage.map((s) => `<tr><td>${esc(s.stage)}</td><td>${s.count}</td></tr>`).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير الفورمن ${from} — ${to}</title>
      <style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:24px;color:#1a1a1a}h1{font-size:18px}h2{font-size:14px;margin-top:22px}
      table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px}
      th{background:#f3f3f3}td:first-child,th:first-child{text-align:right}</style></head>
      <body><h1>تقرير الفورمن</h1><p>الفترة: ${from} ← ${to}</p>
      <h2>أداء العمّال</h2><table><thead><tr><th>العامل</th><th>مهام منجزة</th><th>تركيبات</th><th>أيام حضور</th><th>أيام غياب</th></tr></thead><tbody>${workerRows || '<tr><td colspan="5">لا بيانات</td></tr>'}</tbody></table>
      <h2>حسب القسم / المرحلة</h2><table><thead><tr><th>القسم / المرحلة</th><th>قطع منجزة</th></tr></thead><tbody>${stageRows || '<tr><td colspan="2">لا بيانات</td></tr>'}</tbody></table>
      <script>window.onload=function(){window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const presets: [string, string][] = [["day", "اليوم"], ["week", "الأسبوع"], ["month", "الشهر"], ["year", "السنة"]];

  return (
    <div className="space-y-4">
      {/* Quick-range presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map(([k, l]) => (
          <button key={k} onClick={() => applyPreset(k)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border", preset === k ? "bg-teal-600 text-white border-teal-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500")}>
            {l}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <label className="text-xs font-semibold text-gray-500">من<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(""); }} className="field font-mono-en mt-1" /></label>
        <label className="text-xs font-semibold text-gray-500">إلى<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(""); }} className="field font-mono-en mt-1" /></label>
        <a href={`/api/foreman/reports?from=${from}&to=${to}&format=xlsx`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </a>
        <button onClick={printPdf} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold">
          <FileText className="w-4 h-4" /> PDF
        </button>
      </div>

      {loading ? <div className="flex items-center gap-2 text-gray-400 p-6"><Loader2 className="w-5 h-5 animate-spin" /> …</div> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold text-gray-500 px-3 pt-2">أداء العمّال</p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                <tr>
                  <th className="text-start px-3 py-2 font-bold">العامل</th>
                  <th className="px-3 py-2 font-bold">مهام منجزة</th>
                  <th className="px-3 py-2 font-bold">تركيبات</th>
                  <th className="px-3 py-2 font-bold">حضور</th>
                  <th className="px-3 py-2 font-bold">غياب</th>
                </tr>
              </thead>
              <tbody>
                {(rows || []).map((r) => (
                  <tr key={r.workerId} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2 font-bold">{r.name}</td>
                    <td className="px-3 py-2 text-center font-mono-en">{r.tasksDone}</td>
                    <td className="px-3 py-2 text-center font-mono-en">{r.installs}</td>
                    <td className="px-3 py-2 text-center font-mono-en text-emerald-600">{r.daysPresent}</td>
                    <td className="px-3 py-2 text-center font-mono-en text-red-500">{r.daysAbsent}</td>
                  </tr>
                ))}
                {rows && rows.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-6">لا بيانات في هذه الفترة</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Per-section / per-stage productivity */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold text-gray-500 px-3 pt-2">حسب القسم / المرحلة</p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                <tr>
                  <th className="text-start px-3 py-2 font-bold">القسم / المرحلة</th>
                  <th className="px-3 py-2 font-bold">قطع منجزة</th>
                </tr>
              </thead>
              <tbody>
                {byStage.map((s) => (
                  <tr key={s.stage} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2 font-bold">{s.stage}</td>
                    <td className="px-3 py-2 text-center font-mono-en">{s.count}</td>
                  </tr>
                ))}
                {byStage.length === 0 && <tr><td colSpan={2} className="text-center text-gray-400 py-6">لا بيانات في هذه الفترة</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
