"use client";

import Image from "next/image";
import { Package, MapPin, Phone, CalendarDays, QrCode, Check, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { cn } from "@/lib/utils";
import { stageLabel } from "@/lib/workers";
import { ItemComponentsPanel } from "@/components/item-components-panel";
import { ItemIssuesPanel } from "@/components/item-issues-panel";
import { ItemQcPanel } from "@/components/item-qc-panel";

interface Data {
  id: string; description: string; quantity: number; categoryId: string;
  categoryName: { ar: string; en: string };
  quoteNumber: string; quotationId: string; deliveryDate: string | null; workStatus: string | null;
  customerName: string; phone: string; governorate: string; wilayat: string;
  specs: { labelAr: string; labelEn: string; value: string }[];
  photos: { id: string; url: string; kind: string }[];
  qr: string; canEdit: boolean;
  createdAt: string | null;
  qc: { status: string | null; note: string | null; at: string | null };
  stages: { id: string; stage: string; worker: string | null; color: string | null; createdAt: string; doneAt: string | null; doneByName: string | null }[];
}

function fmtDuration(ms: number, t: (k: "durDays" | "durHours" | "durMins") => string): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} ${t("durMins")}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${t("durHours")}`;
  return `${Math.round(hours / 24)} ${t("durDays")}`;
}

export function ItemPageClient({ data }: { data: Data }) {
  const { t, locale, dir } = useI18n();
  const cat = locale === "en" ? data.categoryName.en : data.categoryName.ar;
  const design = data.photos.filter((p) => p.kind === "design");
  const result = data.photos.filter((p) => p.kind === "result");

  return (
    <div dir={dir} className="mt-3 space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black truncate">{data.description}</h1>
              <span className="text-gray-400 font-mono-en text-sm">×{data.quantity}</span>
            </div>
            <span className="inline-block text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1">{cat}</span>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-3">{displayName(data.customerName, locale)}</p>
            <div className="text-xs text-gray-500 space-y-1 mt-1">
              {(data.governorate || data.wilayat) && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {data.governorate} — {data.wilayat}</p>}
              {data.phone && <p className="flex items-center gap-1 font-mono-en" dir="ltr"><Phone className="w-3.5 h-3.5" /> {data.phone}</p>}
              {data.deliveryDate && <p className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {t("deliveryDate")}: <span className="font-mono-en">{new Date(data.deliveryDate).toLocaleDateString("en-GB")}</span></p>}
            </div>
          </div>
          {data.qr && (
            <div className="shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qr} alt="QR" className="w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700" />
              <span className="text-[9px] text-gray-400 font-mono-en flex items-center justify-center gap-0.5 mt-1"><QrCode className="w-3 h-3" /> {data.quoteNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fixed specs */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-1.5"><Package className="w-4 h-4" /> {t("itemSpecsTitle")}</h2>
        {data.specs.length === 0 ? (
          <p className="text-xs text-gray-400">{t("itemNoSpecs")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {data.specs.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700/50 pb-1.5">
                <span className="text-xs text-gray-500">{locale === "en" ? s.labelEn : s.labelAr}</span>
                <span className="text-sm font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live components (editable by foreman/owner) */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <ItemComponentsPanel itemId={data.id} categoryId={data.categoryId} canEdit={data.canEdit} />
      </div>

      {/* Issues */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <ItemIssuesPanel itemId={data.id} canEdit={data.canEdit} />
      </div>

      {/* Quality control */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <ItemQcPanel itemId={data.id} canEdit={data.canEdit} initial={data.qc} />
      </div>

      {/* Production timeline */}
      {data.stages.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4" /> {t("timelineTitle")}</h2>
          <div className="relative ps-5">
            <div className="absolute top-1 bottom-1 start-[7px] w-px bg-gray-200 dark:bg-gray-700" />
            {data.stages.map((s, i) => {
              const prevDone = i > 0 ? data.stages[i - 1].doneAt : data.createdAt;
              const dur = s.doneAt && prevDone ? fmtDuration(new Date(s.doneAt).getTime() - new Date(prevDone).getTime(), t) : null;
              return (
                <div key={s.id} className="relative pb-4 last:pb-0">
                  <span className={cn("absolute -start-5 top-0.5 w-3.5 h-3.5 rounded-full border-2", s.doneAt ? "bg-emerald-500 border-emerald-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600")}>
                    {s.doneAt && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{stageLabel(s.stage, locale)}</span>
                    {s.worker && <span className="text-[11px] font-semibold text-gray-500">— {s.worker}</span>}
                    {s.doneAt ? (
                      <span className="text-[11px] font-bold text-emerald-600">{t("timelineDone")}</span>
                    ) : (
                      <span className="text-[11px] font-bold text-gray-400">{t("timelinePending")}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap gap-x-3">
                    {s.doneAt && <span className="font-mono-en" dir="ltr">{new Date(s.doneAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                    {dur && <span>⏱ {dur}</span>}
                    {s.doneByName && <span>✓ {s.doneByName}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photos */}
      {(design.length > 0 || result.length > 0) && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-sm font-bold text-gray-500 mb-3">{t("itemPhotosTitle")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <PhotoCol label={t("itemPhotoDesign")} photos={design} />
            <PhotoCol label={t("itemPhotoResult")} photos={result} />
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoCol({ label, photos }: { label: string; photos: { id: string; url: string }[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {photos.length === 0 && <span className="text-xs text-gray-300">—</span>}
        {photos.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block">
            <Image src={p.url} alt="" width={80} height={80} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" unoptimized />
          </a>
        ))}
      </div>
    </div>
  );
}
