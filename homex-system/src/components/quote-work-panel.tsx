"use client";

import { useState } from "react";
import { Wand2, MoreHorizontal } from "lucide-react";
import { useToast } from "@/components/toast";
import { MaterialControl } from "@/components/material-control";
import { SpecSheet, type PItem } from "@/components/production-spec";

// The full work content for ONE quote: material ordering control, the re-apply
// template action, and a spec sheet per section (stages / photos / components).
// Shown on the dedicated work page (/project/[id]); the editing controls are
// wired only when `canEdit`, otherwise everything renders read-only.
export function QuoteWorkPanel({ quoteId, items, workers, woodStatus, fabricStatus, canEdit, onChanged }: {
  quoteId: string;
  items: PItem[];
  workers: { id: string; name: string; color: string }[];
  woodStatus: string;
  fabricStatus: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const apply = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/foreman/apply-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast.success(d.created ? `تم إنشاء ${d.created} مرحلة` : "لا جديد — المراحل موجودة"); onChanged(); }
      else toast.error(d.error || "فشل");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setBusy(false); }
  };

  const advance = async (taskId: string) => {
    try {
      const res = await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, done: true }) });
      if (res.ok) { toast.success("تم — انتقلت للمرحلة التالية"); onChanged(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "فشل"); }
    } catch { toast.error("تعذّر الاتصال"); }
  };

  const toggleStage = async (taskId: string, done: boolean) => {
    try { const r = await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, done }) }); if (r.ok) onChanged(); else toast.error("فشل"); } catch { toast.error("تعذّر الاتصال"); }
  };
  const assignStage = async (taskId: string, wId: string) => {
    try { const r = await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, workerId: wId }) }); if (r.ok) onChanged(); else toast.error("فشل"); } catch { toast.error("تعذّر الاتصال"); }
  };
  const removeStage = async (taskId: string, stageName: string) => {
    if (!window.confirm(`حذف مرحلة «${stageName}»؟`)) return;
    try { const r = await fetch(`/api/item-tasks?id=${taskId}`, { method: "DELETE" }); if (r.ok) onChanged(); else toast.error("فشل"); } catch { toast.error("تعذّر الاتصال"); }
  };
  const setTime = async (taskId: string, iso: string) => {
    try {
      const res = await fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, doneAt: iso }) });
      if (res.ok) { toast.success("تم تحديث وقت الإنجاز"); onChanged(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "فشل"); }
    } catch { toast.error("تعذّر الاتصال"); }
  };

  const uploadPhoto = async (quoteItemId: string, kind: "design" | "result", dataUrl: string) => {
    setUploading(`${quoteItemId}:${kind}`);
    try {
      const res = await fetch("/api/foreman/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteItemId, kind, dataUrl }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast.success("تم رفع الصورة"); onChanged(); }
      else toast.error(d.error || "تعذّر رفع الصورة");
    } catch { toast.error("تعذّر الاتصال"); }
    finally { setUploading(""); }
  };
  const removePhoto = async (photoId: string) => {
    if (!window.confirm("حذف هذه الصورة؟")) return;
    try {
      const res = await fetch(`/api/foreman/photo?id=${photoId}`, { method: "DELETE" });
      if (res.ok) { toast.success("تم حذف الصورة"); onChanged(); }
      else toast.error("تعذّر الحذف");
    } catch { toast.error("تعذّر الاتصال"); }
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <>
          {/* Frequent control (material ordering) stays in view; the rare,
              destructive "re-apply template" tucks into a ⋯ menu. */}
          <div className="flex items-center gap-2">
            <div className="ms-auto relative">
              <button onClick={() => setMenuOpen((v) => !v)} aria-label="المزيد"
                className="w-8 h-8 grid place-items-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute z-20 mt-1 end-0 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1">
                    <button disabled={busy} onClick={() => { setMenuOpen(false); if (window.confirm("إعادة تطبيق قالب مراحل القسم على كل أصناف هذا الكوتيشن؟\nسيتم استبدال المراحل غير المنجزة بمراحل القالب (المراحل المنجزة تبقى).")) apply({ quotationId: quoteId, replace: true }); }}
                      className="w-full flex items-center gap-2 text-start text-xs font-bold px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50">
                      <Wand2 className="w-3.5 h-3.5 text-indigo-600" /> إعادة تطبيق القالب
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
            <MaterialControl quoteId={quoteId} wood={woodStatus || "not_ordered"} fabric={fabricStatus || "not_ordered"} />
          </div>
        </>
      )}

      {items.map((it) => (
        <div key={it.id} className="space-y-1">
          <SpecSheet
            item={it}
            workers={canEdit ? workers : undefined}
            onAdvance={canEdit ? advance : undefined}
            onSetTime={canEdit ? setTime : undefined}
            onToggle={canEdit ? toggleStage : undefined}
            onAssign={canEdit ? assignStage : undefined}
            onRemoveStage={canEdit ? removeStage : undefined}
            onUploadPhoto={canEdit ? uploadPhoto : undefined}
            onDeletePhoto={canEdit ? removePhoto : undefined}
            uploadingKey={uploading}
          />
          {canEdit && !it.hasPipeline && (
            <button disabled={busy} onClick={() => apply({ quoteItemId: it.id })}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline disabled:opacity-50">
              أنشئ مراحل هذا الصنف
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
