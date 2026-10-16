"use client";

import { useState } from "react";
import { Check, X, Plus, Wand2, Loader2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { stageLabel } from "@/lib/workers";

export interface StageRow { id: string; stage: string; workerId: string | null; workerName: string | null; workerColor: string | null; doneAt: string | null; doneByName: string | null }
interface WorkerLite { id: string; name: string; color: string }

// Manufacturing OPERATIONS (مراحل التصنيع) — the big steps a piece passes
// through (تقطيع، تجميع، اكسسوارات…). The foreman marks each done (stamped with
// who/when), assigns a worker, removes steps a given piece doesn't need, or
// applies the category's stage template. Separate from the materials/components
// list on purpose, so operations and procurement never get mixed up.
export function ItemStagesPanel({ itemId, initial, workers, canEdit }: {
  itemId: string; initial: StageRow[]; workers: WorkerLite[]; canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<StageRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");

  const done = rows.filter((r) => r.doneAt).length;

  const toggle = async (r: StageRow) => {
    const next = !r.doneAt;
    setRows((p) => p.map((x) => (x.id === r.id ? { ...x, doneAt: next ? new Date().toISOString() : null } : x)));
    await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, done: next }) }).catch(() => {});
  };
  const assign = async (r: StageRow, workerId: string) => {
    const w = workers.find((x) => x.id === workerId) || null;
    setRows((p) => p.map((x) => (x.id === r.id ? { ...x, workerId: workerId || null, workerName: w?.name || null, workerColor: w?.color || null } : x)));
    await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, workerId }) }).catch(() => {});
  };
  const remove = async (r: StageRow) => {
    setRows((p) => p.filter((x) => x.id !== r.id));
    await fetch(`/api/item-tasks?id=${r.id}`, { method: "DELETE" }).catch(() => {});
  };
  const addStage = async (name: string) => {
    if (!name.trim()) return;
    const res = await fetch("/api/item-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteItemId: itemId, stage: name.trim() }) });
    if (res.ok) { const tk = await res.json(); setRows((p) => [...p, { id: tk.id, stage: tk.stage, workerId: tk.workerId, workerName: tk.worker?.name || null, workerColor: tk.worker?.color || null, doneAt: null, doneByName: null }]); setCustom(""); setAdding(false); }
    else toast.error(t("saveFailed"));
  };
  const applyTemplate = async () => {
    setBusy(true);
    const res = await fetch("/api/foreman/apply-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteItemId: itemId }) });
    if (res.ok) { window.location.reload(); } // simplest reliable refresh of the new stages
    else { toast.error(t("saveFailed")); setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-500 flex items-center gap-1.5"><GitBranch className="w-4 h-4" /> {t("stagesTitle")}
          {rows.length > 0 && <span className="text-[11px] font-mono-en text-gray-400">{done}/{rows.length}</span>}
        </h2>
        {canEdit && rows.length === 0 && (
          <button onClick={applyTemplate} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {t("stagesApplyTemplate")}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">{t("stagesNone")}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2", r.doneAt ? "bg-emerald-50 dark:bg-emerald-900/15" : "bg-gray-50 dark:bg-gray-900/40")}>
              <span className="w-5 h-5 rounded-md bg-white dark:bg-gray-700 grid place-items-center text-[10px] font-mono-en text-gray-400 shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{stageLabel(r.stage, locale)}</div>
                <div className="text-[10px] text-gray-400 flex flex-wrap gap-x-2">
                  {r.doneAt && <span className="font-mono-en" dir="ltr">{new Date(r.doneAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                  {r.doneByName && <span>✓ {r.doneByName}</span>}
                </div>
              </div>
              {canEdit ? (
                <select value={r.workerId || ""} onChange={(e) => assign(r, e.target.value)} className="text-[11px] font-semibold bg-transparent border border-gray-200 dark:border-gray-600 rounded-md px-1.5 py-1 max-w-[90px]">
                  <option value="">—</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              ) : r.workerName ? (
                <span className="text-[11px] font-semibold flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: r.workerColor || "#999" }} />{r.workerName}</span>
              ) : null}
              {canEdit && (
                <>
                  <button onClick={() => toggle(r)} className={cn("w-7 h-7 rounded-md grid place-items-center shrink-0", r.doneAt ? "bg-emerald-500 text-white" : "border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-emerald-600")} title={t("prodMarkDone")}>
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(r)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </>
              )}
              {!canEdit && r.doneAt && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {canEdit && (adding ? (
        <div className="mt-2 flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage(custom)} placeholder={t("stagesAddPlaceholder")} className="field flex-1 h-9 text-sm" autoFocus />
          <button onClick={() => addStage(custom)} className="h-9 px-3 rounded-lg bg-teal-600 text-white text-sm font-bold">{t("compAddConfirm")}</button>
          <button onClick={() => { setAdding(false); setCustom(""); }} className="h-9 px-2 text-sm text-gray-400">{t("qdClose")}</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700"><Plus className="w-3.5 h-3.5" /> {t("stagesAdd")}</button>
      ))}
    </div>
  );
}
