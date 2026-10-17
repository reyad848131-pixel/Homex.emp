"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Phone, CalendarDays, Printer } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { QuoteWorkPanel } from "@/components/quote-work-panel";
import type { PItem } from "@/components/production-spec";

interface Data {
  id: string; quoteNumber: string; deliveryDate: string | null; workStatus: string | null;
  woodStatus: string; fabricStatus: string;
  customerName: string; phone: string; governorate: string; wilayat: string;
  canEdit: boolean; items: PItem[]; workers: { id: string; name: string; color: string }[];
}

const card = "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5";

export function ProjectPageClient({ data }: { data: Data }) {
  const { t, locale, dir } = useI18n();
  const router = useRouter();

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/foreman");
  };
  const reload = () => router.refresh();

  return (
    <div dir={dir} className="mt-1 space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" /> {t("back")}
      </button>

      {/* Project header: customer + quote number + location + barcode */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{displayName(data.customerName, locale)}</p>
            <p className="text-sm font-mono-en text-teal-700 font-bold mt-0.5">{data.quoteNumber}</p>
            <div className="text-xs text-gray-500 space-y-1 mt-2">
              {(data.governorate || data.wilayat) && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {data.governorate} — {data.wilayat}</p>}
              {data.phone && <p className="flex items-center gap-1 font-mono-en" dir="ltr"><Phone className="w-3.5 h-3.5" /> {data.phone}</p>}
              {data.deliveryDate && <p className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {t("deliveryDate")}: <span className="font-mono-en">{new Date(data.deliveryDate).toLocaleDateString("en-GB")}</span></p>}
            </div>
            <a href={`/api/quote/${data.id}/label`} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-1.5 hover:bg-teal-50 dark:hover:bg-teal-900/20">
              <Printer className="w-4 h-4" /> {t("printLabel")}
            </a>
          </div>
          <div className="shrink-0 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/quote/${data.id}/qr`} alt="QR" className="w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white" />
            <span className="block text-[9px] text-gray-400 font-bold mt-1">{t("projectBarcode")}</span>
          </div>
        </div>
      </div>

      {/* Full work content: material control, template, spec sheets per section */}
      <QuoteWorkPanel
        quoteId={data.id}
        items={data.items}
        workers={data.workers}
        woodStatus={data.woodStatus}
        fabricStatus={data.fabricStatus}
        canEdit={data.canEdit}
        onChanged={reload}
      />
    </div>
  );
}
