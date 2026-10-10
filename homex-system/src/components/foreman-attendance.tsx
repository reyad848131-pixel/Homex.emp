"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ChevronRight, ChevronLeft, Loader2, Save, Lock, Pencil, CheckCheck, FileSpreadsheet, FileText, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";

type Rec = { workerId: string; name: string; color: string; status: string; reason: string; note: string; recorded: boolean };
type Session = { date: string; period: string; workers: Rec[]; takenAt: string | null; takenByName: string; locked: boolean };

const todayStr = () => new Date().toISOString().slice(0, 10);
const shiftDay = (d: string, n: number) => { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };

const STATUSES: [string, string][] = [["present", "حاضر"], ["onsite", "بالموقع"], ["absent", "غائب"]];
const REASONS: [string, string][] = [["vacation", "إجازة"], ["sick", "مرضي"], ["unexcused", "بدون عذر"], ["duty", "مأمورية"]];
const fmtTime = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getHours())}:${p(d.getMinutes())}`; };

export default function AttendanceConsole() {
  const [view, setView] = useState<"daily" | "monthly">("daily");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["daily", "التحضير اليومي"], ["monthly", "التقرير الشهري"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={cn("flex-1 py-2 rounded-lg text-sm font-bold border transition-colors",
              view === k ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
            {l}
          </button>
        ))}
      </div>
      {view === "daily" ? <DailyAttendance /> : <MonthlyReport />}
    </div>
  );
}

function DailyAttendance() {
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [period, setPeriod] = useState<"morning" | "evening">(new Date().getHours() < 14 ? "morning" : "evening");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, { status: string; reason: string; note: string }>>({});
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const isPast = date < todayStr();

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (m) setIsOwner(["2016", "1389"].includes(m.civilId || ""));
    }).catch(() => {});
  }, []);

  const load = useCallback(async (d: string, p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/foreman/attendance?date=${d}&period=${p}`);
      if (res.ok) {
        const s: Session = await res.json();
        setSession(s);
        const map: Record<string, { status: string; reason: string; note: string }> = {};
        for (const w of s.workers) map[w.workerId] = { status: w.status, reason: w.reason, note: w.note };
        setEdits(map);
        setEditing(!s.locked); // editable by default when not yet saved
        setEditNote("");
      } else toast.error("تعذّر التحميل");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(date, period); }, [date, period, load]);

  const setStatus = (workerId: string, status: string) =>
    setEdits((prev) => ({ ...prev, [workerId]: { ...prev[workerId], status, reason: status === "absent" ? prev[workerId]?.reason || "" : "" } }));
  const setReason = (workerId: string, reason: string) =>
    setEdits((prev) => ({ ...prev, [workerId]: { ...prev[workerId], reason } }));
  const setNote = (workerId: string, note: string) =>
    setEdits((prev) => ({ ...prev, [workerId]: { ...prev[workerId], note } }));
  const allPresent = () =>
    setEdits((prev) => { const n = { ...prev }; for (const k of Object.keys(n)) n[k] = { status: "present", reason: "", note: n[k]?.note || "" }; return n; });

  const counts = useMemo(() => {
    let present = 0, onsite = 0, absent = 0;
    for (const w of session?.workers || []) {
      const s = edits[w.workerId]?.status || "present";
      if (s === "present") present++; else if (s === "onsite") onsite++; else absent++;
    }
    return { present, onsite, absent };
  }, [edits, session]);

  const save = async () => {
    if (isPast && !editNote.trim()) { toast.error("اكتب سبب التعديل أولاً"); return; }
    setSaving(true);
    try {
      const records = (session?.workers || []).map((w) => ({ workerId: w.workerId, status: edits[w.workerId]?.status || "present", reason: edits[w.workerId]?.reason || "", note: edits[w.workerId]?.note || "" }));
      const res = await fetch("/api/foreman/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, period, records, editNote: editNote.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast.success("تم حفظ التحضير ✅"); load(date, period); }
      else toast.error(d.error || "فشل الحفظ");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setSaving(false); }
  };

  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("ar-OM", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const canEditPast = !isPast || isOwner;

  return (
    <div className="space-y-4">
      {/* Day navigation */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
        <button onClick={() => setDate(shiftDay(date, -1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight className="w-5 h-5" /></button>
        <div className="flex-1 text-center">
          <p className="text-sm font-bold">{dayLabel}</p>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} max={todayStr()} className="text-xs text-gray-400 bg-transparent text-center font-mono-en" />
        </div>
        <button onClick={() => setDate(shiftDay(date, 1))} disabled={date >= todayStr()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
        {date !== todayStr() && <button onClick={() => setDate(todayStr())} className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold">اليوم</button>}
      </div>

      {/* Shift toggle */}
      <div className="flex gap-2">
        {([["morning", "تحضير الصباح"], ["evening", "تحضير المساء"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            className={cn("flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors", period === k ? "bg-teal-600 text-white border-teal-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <div className="flex items-center gap-2 text-gray-400 p-6"><Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…</div> : (
        <>
          {/* Live counters + lock stamp */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold">حاضر: {counts.present}</span>
            <span className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-bold">بالموقع: {counts.onsite}</span>
            <span className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-bold">غائب: {counts.absent}</span>
            {session?.locked && session.takenAt && (
              <span className="ms-auto inline-flex items-center gap-1 text-[11px] text-gray-400"><Lock className="w-3 h-3" /> آخر تحضير: {fmtTime(session.takenAt)}{session.takenByName ? ` · ${session.takenByName}` : ""}</span>
            )}
          </div>

          {/* Locked banner + edit control */}
          {session?.locked && !editing && (
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-gray-600 dark:text-gray-300">هذه الفترة محضّرة ومقفلة.</span>
              {canEditPast ? (
                <button onClick={() => setEditing(true)} className="ms-auto inline-flex items-center gap-1 text-teal-600 font-bold"><Pencil className="w-3.5 h-3.5" /> تعديل</button>
              ) : (
                <span className="ms-auto text-[11px] text-gray-400">التعديل لرياض/سالم فقط</span>
              )}
            </div>
          )}

          {/* Past-edit reason (owners) */}
          {editing && isPast && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <label className="text-xs font-bold text-amber-700 dark:text-amber-300">سبب تعديل يوم سابق (إلزامي)</label>
              <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="مثال: تصحيح غياب — كان بمأمورية" className="field mt-1 w-full" />
            </div>
          )}

          {editing && (
            <button onClick={allPresent} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
              <CheckCheck className="w-4 h-4" /> تعيين الكل حاضر
            </button>
          )}

          {/* Roster */}
          <div className="space-y-2">
            {(session?.workers || []).map((w) => {
              const e = edits[w.workerId] || { status: "present", reason: "", note: "" };
              return (
                <div key={w.workerId} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: w.color }} />
                      <span className="font-bold truncate">{w.name}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {STATUSES.map(([k, l]) => (
                        <button key={k} disabled={!editing} onClick={() => setStatus(w.workerId, k)}
                          className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors disabled:opacity-60",
                            e.status === k
                              ? k === "absent" ? "bg-red-600 text-white border-red-600" : k === "onsite" ? "bg-amber-500 text-white border-amber-500" : "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {e.status === "absent" && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {REASONS.map(([k, l]) => (
                        <button key={k} disabled={!editing} onClick={() => setReason(w.workerId, k)}
                          className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold border disabled:opacity-60", e.reason === k ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-600" : "border-gray-200 dark:border-gray-600 text-gray-500")}>
                          {l}
                        </button>
                      ))}
                      <input disabled={!editing} value={e.note} onChange={(ev) => setNote(w.workerId, ev.target.value)} placeholder="ملاحظة (اختياري)" className="field h-8 text-xs flex-1 min-w-[120px] disabled:opacity-60" />
                    </div>
                  )}
                </div>
              );
            })}
            {(session?.workers || []).length === 0 && <p className="text-sm text-gray-400 text-center p-6">لا يوجد عمّال نشطون.</p>}
          </div>

          {/* Save */}
          {editing && (
            <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ التحضير
            </button>
          )}
        </>
      )}
    </div>
  );
}

function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/foreman/attendance/report?year=${year}&month=${month}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [year, month]);
  useEffect(() => { load(); }, [load]);

  const codeCell = (s?: string) => s === "present" ? "ح" : s === "onsite" ? "م" : s === "absent" ? "غ" : "–";
  const codeColor = (s?: string) => s === "absent" ? "text-red-500" : s === "onsite" ? "text-amber-600" : s === "present" ? "text-emerald-600" : "text-gray-300";

  const printPdf = () => {
    if (!data) return;
    const esc = (s: any) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
    const head = Array.from({ length: data.daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join("");
    const body = data.rows.map((r: any) => {
      const cells = Array.from({ length: data.daysInMonth }, (_, i) => {
        const c = r.days[i + 1];
        return `<td>${c ? `${codeCell(c.am)}/${codeCell(c.pm)}` : ""}</td>`;
      }).join("");
      return `<tr><td class="n">${esc(r.name)}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.pct == null ? "" : r.pct + "%"}</td>${cells}</tr>`;
    }).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف الحضور ${year}-${month}</title>
      <style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:16px;color:#1a1a1a}h1{font-size:16px}
      table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:3px 5px;text-align:center;font-size:10px}
      th{background:#f3f3f3}td.n,th.n{text-align:right;white-space:nowrap}</style></head>
      <body><h1>كشف الحضور الشهري — ${month}/${year}</h1>
      <p style="font-size:11px;color:#666">ح=حاضر · م=بالموقع · غ=غائب (صباح/مساء)</p>
      <table><thead><tr><th class="n">العامل</th><th>حضور</th><th>غياب</th><th>نسبة</th>${head}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=function(){window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="field w-auto h-9 text-sm">
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="field w-auto h-9 text-sm font-mono-en">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <a href={`/api/foreman/attendance/report?year=${year}&month=${month}&format=xlsx`} target="_blank" rel="noopener noreferrer"
          className="ms-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"><FileSpreadsheet className="w-4 h-4" /> Excel</a>
        <button onClick={printPdf} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold"><FileText className="w-4 h-4" /> PDF</button>
      </div>

      <p className="text-[11px] text-gray-400">ح=حاضر · م=بالموقع · غ=غائب (صباح/مساء)</p>

      {loading ? <div className="flex items-center gap-2 text-gray-400 p-6"><Loader2 className="w-5 h-5 animate-spin" /> …</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
              <tr>
                <th className="text-start px-2 py-2 font-bold sticky start-0 bg-gray-50 dark:bg-gray-800">العامل</th>
                <th className="px-2 py-2 font-bold">حضور</th>
                <th className="px-2 py-2 font-bold">غياب</th>
                <th className="px-2 py-2 font-bold">نسبة</th>
                {data && Array.from({ length: data.daysInMonth }, (_, i) => <th key={i} className="px-1.5 py-2 font-mono-en font-bold">{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map((r: any) => (
                <tr key={r.workerId} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-2 py-1.5 font-bold whitespace-nowrap sticky start-0 bg-white dark:bg-gray-800">{r.name}</td>
                  <td className="px-2 py-1.5 text-center font-mono-en text-emerald-600">{r.present}</td>
                  <td className="px-2 py-1.5 text-center font-mono-en text-red-500">{r.absent}</td>
                  <td className="px-2 py-1.5 text-center font-mono-en font-bold">{r.pct == null ? "–" : `${r.pct}%`}</td>
                  {data && Array.from({ length: data.daysInMonth }, (_, i) => {
                    const c = r.days[i + 1];
                    return <td key={i} className="px-1 py-1.5 text-center font-mono-en text-[10px]">
                      {c ? <span><span className={codeColor(c.am)}>{codeCell(c.am)}</span>/<span className={codeColor(c.pm)}>{codeCell(c.pm)}</span></span> : <span className="text-gray-300">·</span>}
                    </td>;
                  })}
                </tr>
              ))}
              {data && data.rows.length === 0 && <tr><td colSpan={4 + data.daysInMonth} className="text-center text-gray-400 py-6">لا بيانات</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
