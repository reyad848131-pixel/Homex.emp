"use client";

import Image from "next/image";
import { Package, MapPin, Phone, CalendarDays, QrCode, ImageIcon, Printer } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { ItemDescBlock } from "@/components/item-desc-block";
import { ItemComponentsPanel } from "@/components/item-components-panel";
import { ItemIssuesPanel } from "@/components/item-issues-panel";
import { ItemQcPanel } from "@/components/item-qc-panel";
import { ItemStagesPanel, type StageRow } from "@/components/item-stages-panel";
import { MaterialControl } from "@/components/material-control";

interface Data {
  id: string; description: string; quantity: number; categoryId: string;
  categoryName: { ar: string; en: string };
  quoteNumber: string; quotationId: string; deliveryDate: string | null; workStatus: string | null;
  woodStatus: string; fabricStatus: string;
  customerName: string; phone: string; governorate: string; wilayat: string;
  specs: { labelAr: string; labelEn: string; value: string }[];
  photos: { id: string; url: string; kind: string }[];
  qr: string; canEdit: boolean;
  qc: { status: string | null; note: string | null; at: string | null };
  workers: { id: string; name: string; color: string }[];
  stages: StageRow[];
}

const card = "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5";

export function ItemPageClient({ data }: { data: Data }) {
  const { t, locale, dir } = useI18n();
  const cat = locale === "en" ? data.categoryName.en : data.categoryName.ar;
  const design = data.photos.find((p) => p.kind === "design") || null;

  return (
    <div dir={dir} className="mt-3 space-y-4">
      {/* Header */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-gray-400 font-mono-en text-sm">×{data.quantity}</span>
              <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{cat}</span>
            </div>
            <ItemDescBlock text={data.description} />
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
              <a href={`/api/item/${data.id}/label`} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 border border-teal-200 dark:border-teal-800 rounded-lg px-2 py-1 hover:bg-teal-50 dark:hover:bg-teal-900/20">
                <Printer className="w-3.5 h-3.5" /> {t("printLabel")}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Design photo (reference for verifying the work) */}
      <div className={card}>
        <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> {t("itemPhotoDesign")}</h2>
        {design ? (
          <a href={design.url} target="_blank" rel="noreferrer" className="block">
            <Image src={design.url} alt="design" width={640} height={420} className="w-full max-h-80 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40" unoptimized />
          </a>
        ) : (
          <p className="text-xs text-gray-400">{t("itemNoDesignPhoto")}</p>
        )}
      </div>

      {/* Fixed specs */}
      <div className={card}>
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

      {/* Manufacturing operations (مراحل التصنيع) */}
      <div className={card}>
        <ItemStagesPanel itemId={data.id} initial={data.stages} workers={data.workers} canEdit={data.canEdit} />
      </div>

      {/* Order-level materials (wood/fabric) + per-item components (الطلبات والعناصر) */}
      <div className={card}>
        {data.canEdit && (
          <div className="pb-3 mb-3 border-b border-dashed border-gray-200 dark:border-gray-700">
            <MaterialControl quoteId={data.quotationId} wood={data.woodStatus} fabric={data.fabricStatus} />
          </div>
        )}
        <ItemComponentsPanel itemId={data.id} categoryId={data.categoryId} canEdit={data.canEdit} />
      </div>

      {/* Issues */}
      <div className={card}>
        <ItemIssuesPanel itemId={data.id} canEdit={data.canEdit} />
      </div>

      {/* Quality control */}
      <div className={card}>
        <ItemQcPanel itemId={data.id} canEdit={data.canEdit} initial={data.qc} />
      </div>
    </div>
  );
}
