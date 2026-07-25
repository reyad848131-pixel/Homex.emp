"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ErrorEntry {
  id: string;
  message: string;
  digest: string | null;
  path: string | null;
  method: string | null;
  routeType: string | null;
  stack: string | null;
  createdAt: string;
}

export default function ErrorLogsPage() {
  const [data, setData] = useState<{ logs: ErrorEntry[]; total: number; totalPages: number }>({ logs: [], total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { t, dateLocale } = useI18n();

  useEffect(() => {
    fetch(`/api/error-logs?page=${page}&limit=30`).then((r) => r.json()).then(setData);
  }, [page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            {t("errorLogsTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{data.total} {t("errorCount")}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        {data.logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-semibold">{t("noErrors")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:bg-gray-900/40">
                <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">{t("date")}</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("errorMessageCol")}</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("errorPathCol")}</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((e) => (
                <>
                  <tr key={e.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <td className="p-3 px-5 text-xs text-gray-400 font-mono-en whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="p-3 text-red-600 dark:text-red-400 font-semibold max-w-sm truncate">{e.message}</td>
                    <td className="p-3 text-xs text-gray-500 font-mono-en">{e.method ? `${e.method} ` : ""}{e.path || "—"}</td>
                    <td className="p-3 text-gray-400">
                      {expanded === e.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr className="bg-gray-50 dark:bg-gray-900/40">
                      <td colSpan={4} className="p-4 px-5">
                        {e.digest && <p className="text-xs text-gray-500 mb-2"><b>digest:</b> <span className="font-mono-en">{e.digest}</span></p>}
                        <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-all bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 max-h-64 overflow-y-auto">
                          {e.stack || e.message}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm font-bold disabled:opacity-30">{t("previous")}</button>
          <span className="text-sm text-gray-500 font-mono-en">{page} / {data.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm font-bold disabled:opacity-30">{t("next")}</button>
        </div>
      )}
    </div>
  );
}
