"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Check, X, GitBranch, Clock, Camera, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemDescBlock } from "@/components/item-desc-block";
import { RetryImg } from "@/components/retry-img";

// Shared production building blocks — the per-item spec sheet (with its
// interactive manufacturing stages, photos and completion times) plus its photo
// slot and image helpers. Used by the per-quote work page and by the foreman
// console's by-worker view, so the two stay identical.

export type SpecRow = { labelAr: string; labelEn: string; value: string };
export type PTask = { id: string; stage: string; workerId: string | null; workerName: string; workerColor: string; done: boolean; doneAt: string | null };
export type Photo = { id: string; url: string };
export type PItem = { id: string; categoryId: string; description: string; quantity: number; specs: SpecRow[]; photos: { design: Photo | null; result: Photo | null }; hasPipeline: boolean; tasks: PTask[] };

// Downscale + JPEG-compress an image file in the browser before upload, so
// camera shots (often 3–5MB) go up as ~200–400KB — keeps storage tiny.
export function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no ctx")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PhotoSlot({ label, kind, itemId, photo, busy, onUpload, onDelete }: {
  label: string; kind: "design" | "result"; itemId: string; photo: Photo | null; busy: boolean;
  onUpload: (itemId: string, kind: "design" | "result", dataUrl: string) => void;
  onDelete: (photoId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPreparing(true);
    try { const dataUrl = await compressImage(f); onUpload(itemId, kind, dataUrl); }
    catch { /* ignore */ }
    finally { setPreparing(false); }
  };
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-bold text-gray-400 mb-1">{label}</p>
      {photo ? (
        <div className="relative">
          <a href={photo.url} target="_blank" rel="noopener noreferrer">
            <RetryImg src={photo.url} alt={label} className="w-full h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
          </a>
          <button onClick={() => onDelete(photo.id)} className="absolute top-1 start-1 w-5 h-5 grid place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy || preparing}
          className="w-full h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 grid place-items-center text-gray-400 hover:border-teal-400 disabled:opacity-50">
          {busy || preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex flex-col items-center text-[10px] font-bold"><Camera className="w-4 h-4 mb-0.5" /> أضف صورة</span>}
        </button>
      )}
      {/* No `capture` attribute → the native picker offers camera, photo
          library and files, instead of forcing the camera only. */}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}

// ISO → local "YYYY-MM-DDTHH:MM" for a datetime-local input.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SpecSheet({ item, workers, onAdvance, onSetTime, onToggle, onAssign, onRemoveStage, onUploadPhoto, onDeletePhoto, uploadingKey }: {
  item: PItem;
  workers?: { id: string; name: string; color: string }[];
  onAdvance?: (taskId: string) => void;
  onSetTime?: (taskId: string, iso: string) => void;
  onToggle?: (taskId: string, done: boolean) => void;
  onAssign?: (taskId: string, workerId: string) => void;
  onRemoveStage?: (taskId: string, stageName: string) => void;
  onUploadPhoto?: (itemId: string, kind: "design" | "result", dataUrl: string) => void;
  onDeletePhoto?: (photoId: string) => void;
  uploadingKey?: string;
}) {
  const [editTimes, setEditTimes] = useState(false);
  const current = item.tasks.find((t) => !t.done);
  const allDone = item.tasks.length > 0 && !current;
  const doneTasks = item.tasks.filter((t) => t.done);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><ItemDescBlock text={item.description} compact /></div>
        <div className="flex items-center gap-2 shrink-0">
          {item.quantity > 1 && <span className="text-[11px] font-mono-en font-bold text-gray-400">×{item.quantity}</span>}
          <Link href={`/item/${item.id}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 border border-teal-200 dark:border-teal-800 rounded-lg px-2 py-1">
            <ClipboardList className="w-3.5 h-3.5" /> التفاصيل
          </Link>
        </div>
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

      {/* Design + result photos — shown ABOVE the stages, per the foreman's ask */}
      {onUploadPhoto && onDeletePhoto && (
        <div className="flex gap-2 pt-1">
          <PhotoSlot label="📐 التصميم" kind="design" itemId={item.id} photo={item.photos?.design || null}
            busy={uploadingKey === `${item.id}:design`} onUpload={onUploadPhoto} onDelete={onDeletePhoto} />
          <PhotoSlot label="✅ النتيجة" kind="result" itemId={item.id} photo={item.photos?.result || null}
            busy={uploadingKey === `${item.id}:result`} onUpload={onUploadPhoto} onDelete={onDeletePhoto} />
        </div>
      )}

      {/* Manufacturing stages — interactive (mark done / assign / remove), laid
          out 2–3 per row to save space (same controls as the item details page). */}
      {item.tasks.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1.5 text-[11px] font-bold text-gray-500">
            <GitBranch className="w-3.5 h-3.5" /> مراحل التصنيع <span className="font-mono-en text-gray-400">{doneTasks.length}/{item.tasks.length}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
            {item.tasks.map((t, i) => (
              <div key={t.id} className={cn("rounded-lg border p-1.5 flex flex-col gap-1",
                t.done ? "bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800"
                  : t.id === current?.id ? "bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-700"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700")}>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono-en text-gray-400 shrink-0">{i + 1}</span>
                  <span className="text-[11px] font-bold truncate flex-1">{t.stage}</span>
                  {onRemoveStage && <button onClick={() => onRemoveStage(t.id, t.stage)} className="text-gray-300 hover:text-red-500 shrink-0" title="حذف"><X className="w-3 h-3" /></button>}
                </div>
                <div className="flex items-center gap-1">
                  {onAssign && workers ? (
                    <select value={t.workerId || ""} onChange={(e) => onAssign(t.id, e.target.value)}
                      className="text-[10px] bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 flex-1 min-w-0">
                      <option value="">—</option>
                      {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  ) : <span className="text-[10px] text-gray-400 flex-1 truncate">{t.workerName || "—"}</span>}
                  {onToggle && (
                    <button onClick={() => onToggle(t.id, !t.done)} title="تم"
                      className={cn("w-6 h-6 rounded grid place-items-center shrink-0", t.done ? "bg-emerald-500 text-white" : "border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-emerald-600")}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {t.done && t.doneAt && <span className="text-[9px] text-gray-400 font-mono-en" dir="ltr">{fmtTime(t.doneAt)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion times — view & correct to the minute */}
      {onSetTime && doneTasks.length > 0 && (
        <div>
          <button onClick={() => setEditTimes((v) => !v)} className="text-[10px] font-bold text-gray-500 inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
            <Clock className="w-3 h-3" /> أوقات الإنجاز {editTimes ? "▴" : "▾"}
          </button>
          {editTimes && (
            <div className="mt-1 space-y-1">
              {doneTasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 font-bold text-gray-500 truncate shrink-0">{t.stage}</span>
                  <input type="datetime-local" defaultValue={toLocalInput(t.doneAt)}
                    onBlur={(e) => { if (e.target.value) onSetTime(t.id, new Date(e.target.value).toISOString()); }}
                    className="field h-8 text-xs font-mono-en" />
                </label>
              ))}
            </div>
          )}
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
