"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";

interface Issue { id: string; note: string; photoUrl: string | null; status: string; createdAt: string }

// Flag/resolve problems on an item (missing material, wrong measure, defect…).
// View open to any signed-in user; raise/resolve limited to the foreman/owner.
export function ItemIssuesPanel({ itemId, canEdit }: { itemId: string; canEdit: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch(`/api/item-issues?itemId=${itemId}`).then((r) => (r.ok ? r.json() : [])).then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [itemId]);

  const add = async () => {
    if (!note.trim()) return;
    const res = await fetch("/api/item-issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, note: note.trim() }) });
    if (res.ok) { const created = await res.json(); setRows((p) => [created, ...p]); setNote(""); setAdding(false); }
    else toast.error(t("saveFailed"));
  };
  const resolve = async (id: string, resolved: boolean) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: resolved ? "resolved" : "open" } : r)));
    await fetch("/api/item-issues", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: resolved ? "resolved" : "open" }) });
  };
  const remove = async (id: string) => { if (!window.confirm("حذف هذه الملاحظة؟")) return; setRows((p) => p.filter((r) => r.id !== id)); await fetch(`/api/item-issues?id=${id}`, { method: "DELETE" }).catch(() => {}); };

  if (loading) return <div className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> …</div>;

  const open = rows.filter((r) => r.status === "open");

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
          <AlertTriangle className={cn("w-4 h-4", open.length ? "text-red-500" : "text-gray-400")} /> {t("issuesTitle")}
          {open.length > 0 && <span className="text-[11px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 rounded-full px-2">{open.length}</span>}
        </h2>
        {canEdit && !adding && <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"><Plus className="w-3.5 h-3.5" /> {t("issueRaise")}</button>}
      </div>

      {adding && (
        <div className="flex gap-2 mb-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={t("issuePlaceholder")} className="field flex-1 h-9 text-sm" autoFocus />
          <button onClick={add} className="h-9 px-3 rounded-lg bg-red-600 text-white text-sm font-bold">{t("compAddConfirm")}</button>
          <button onClick={() => { setAdding(false); setNote(""); }} className="h-9 px-2 text-sm text-gray-400">{t("qdClose")}</button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">{t("issuesNone")}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm", r.status === "open" ? "bg-red-50 dark:bg-red-900/15" : "bg-gray-50 dark:bg-gray-900/40 opacity-60")}>
              <span className={cn("flex-1 min-w-0", r.status === "resolved" && "line-through")}>{r.note}</span>
              {r.status === "open"
                ? <span className="text-[10px] font-bold text-red-600">{t("issueOpen")}</span>
                : <span className="text-[10px] font-bold text-green-600">{t("issueResolved")}</span>}
              {canEdit && (
                <>
                  <button onClick={() => resolve(r.id, r.status === "open")} className="text-gray-400 hover:text-green-600" title={t("issueToggle")}><Check className="w-4 h-4" /></button>
                  <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
