"use client";

import { useI18n } from "@/lib/i18n";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, dir } = useI18n();
  return (
    <div
      dir={dir}
      className="min-h-screen flex items-center justify-center bg-neutral-50 p-4"
    >
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">
          {t("unexpectedError")}
        </h2>
        <p className="text-neutral-600 mb-6">
          {t("errorPageDesc")}
        </p>
        <button
          onClick={reset}
          className="bg-neutral-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-neutral-800 transition-colors"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
