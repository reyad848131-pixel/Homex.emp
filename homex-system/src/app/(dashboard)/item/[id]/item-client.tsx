"use client";

import Image from "next/image";
import { Package, MapPin, Phone, CalendarDays, QrCode } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { ItemComponentsPanel } from "@/components/item-components-panel";

interface Data {
  id: string; description: string; quantity: number; categoryId: string;
  categoryName: { ar: string; en: string };
  quoteNumber: string; quotationId: string; deliveryDate: string | null; workStatus: string | null;
  customerName: string; phone: string; governorate: string; wilayat: string;
  specs: { labelAr: string; labelEn: string; value: string }[];
  photos: { id: string; url: string; kind: string }[];
  qr: string; canEdit: boolean;
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
