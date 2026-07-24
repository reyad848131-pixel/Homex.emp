"use client";

import { useI18n } from "@/lib/i18n";

export default function Loading() {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
        <p className="text-sm text-neutral-500">{t("loading")}</p>
      </div>
    </div>
  );
}
