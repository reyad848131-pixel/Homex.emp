"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Phone, CalendarDays, Printer, Package, ChevronLeft, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  categoryName: { ar: string; en: string };
  title: string;
  quantity: number;
  done: number;
  total: number;
}
interface Data {
  id: string; quoteNumber: string; deliveryDate: string | null;
  customerName: string; phone: string; governorate: string; wilayat: string;
  canEdit: boolean; sections: Section[];
}

const card = "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5";

export function ProjectPageClient({ data }: { data: Data }) {
  const { t, locale, dir } = useI18n();
  const router = useRouter();

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/foreman");
  };

  return (
    <div dir={dir} className="mt-1 space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" /> {t("back")}
      </button>

      {/* Project header */}
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
          </div>
          <a href={`/api/quote/${data.id}/label`} target="_blank" rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-900/20">
            <Printer className="w-4 h-4" /> {t("printLabel")}
          </a>
        </div>
      </div>

      {/* Sections, in order */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1.5 px-1">
          <Package className="w-4 h-4" /> {t("projectSections")} <span className="font-mono-en text-gray-400">({data.sections.length})</span>
        </h2>
        <div className="space-y-2">
          {data.sections.map((s, i) => {
            const cat = locale === "en" ? s.categoryName.en : s.categoryName.ar;
            const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
            const allDone = s.total > 0 && s.done === s.total;
            return (
              <Link key={s.id} href={`/item/${s.id}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-gray-100 dark:bg-gray-700 font-mono-en text-sm font-bold text-gray-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{cat}</span>
                    {s.quantity > 1 && <span className="text-[11px] font-mono-en text-gray-400">×{s.quantity}</span>}
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mt-1">{s.title}</p>
                  {s.total > 0 ? (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div className={cn("h-full rounded-full", allDone ? "bg-emerald-500" : "bg-teal-500")} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-mono-en font-bold shrink-0 flex items-center gap-0.5", allDone ? "text-emerald-600" : "text-gray-500")}>
                        {allDone && <Check className="w-3 h-3" />}{s.done}/{s.total}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1.5">{t("projectNoStages")}</p>
                  )}
                </div>
                <ChevronLeft className="shrink-0 w-5 h-5 text-gray-300 rtl:rotate-0 ltr:rotate-180" />
              </Link>
            );
          })}
          {data.sections.length === 0 && <p className="text-sm text-gray-400 px-1">{t("projectNoSections")}</p>}
        </div>
      </div>
    </div>
  );
}
