"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t, dir } = useI18n();
  return (
    <div
      dir={dir}
      className="min-h-screen flex items-center justify-center bg-neutral-50 p-4"
    >
      <div className="text-center max-w-md">
        <div className="text-7xl font-black text-neutral-200 mb-4">404</div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">
          {t("pageNotFound")}
        </h2>
        <p className="text-neutral-600 mb-6">
          {t("pageNotFoundDesc")}
        </p>
        <Link
          href="/"
          className="inline-block bg-neutral-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-neutral-800 transition-colors"
        >
          {t("returnHome")}
        </Link>
      </div>
    </div>
  );
}
