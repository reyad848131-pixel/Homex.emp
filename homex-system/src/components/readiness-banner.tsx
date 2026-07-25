"use client";

import Link from "next/link";
import { ClipboardCheck, ArrowLeft, Settings } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const LABELS: Record<string, TranslationKey> = {
  company_name: "needCompanyName",
  company_logo: "needLogo",
  company_phone: "needPhone",
  vat_rate: "needVat",
  terms_conditions: "needTerms",
};

// Admin-only nudge: lists the essential company settings that are still empty,
// so quotations and invoices go out complete. Hidden once everything is set.
export function ReadinessBanner({ missing }: { missing: string[] }) {
  const { t } = useI18n();
  if (!missing || missing.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <ClipboardCheck className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{t("readinessTitle")}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{t("readinessHint")}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {missing.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  <Settings className="w-3 h-3" /> {LABELS[k] ? t(LABELS[k]) : k}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Link href="/settings"
          className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors shrink-0">
          {t("goToSettings")} <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
