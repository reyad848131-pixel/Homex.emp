"use client";

import { useState, useEffect } from "react";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  employee: { name: string };
}

const ACTION_KEYS: Record<string, TranslationKey> = {
  create: "actionCreate",
  update: "actionUpdate",
  delete: "actionDelete",
  status_change: "actionStatusChange",
};

const ENTITY_KEYS: Record<string, TranslationKey> = {
  quotation: "entityQuotation",
  employee: "entityEmployee",
  settings: "entitySettings",
  customer: "entityCustomer",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  status_change: "bg-yellow-100 text-yellow-700",
};

export default function AuditLogsPage() {
  const [data, setData] = useState<{ logs: AuditEntry[]; total: number; totalPages: number }>({ logs: [], total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const { t, dateLocale } = useI18n();

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    if (search.trim()) params.set("search", search.trim());
    const timer = setTimeout(() => {
      fetch(`/api/audit-logs?${params}`).then((r) => r.json()).then(setData);
    }, 250);
    return () => clearTimeout(timer);
  }, [page, entity, action, search]);

  useEffect(() => { setPage(1); }, [entity, action, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="w-6 h-6" />
            {t("auditLogsTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{data.total} {t("logCount")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("alSearchPh")} className="field w-auto min-w-[12rem]" />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="field w-auto">
            <option value="">{t("alAllActions")}</option>
            <option value="create">{t("alCreate")}</option>
            <option value="update">{t("alUpdate")}</option>
            <option value="status_change">{t("alStatusChange")}</option>
            <option value="reassign">{t("alReassign")}</option>
            <option value="renumber">{t("alRenumber")}</option>
            <option value="import">{t("alImport")}</option>
            <option value="import_undo">{t("alImportUndo")}</option>
            <option value="delete">{t("alDelete")}</option>
            <option value="reset_password">{t("alResetPw")}</option>
            <option value="reset_passwords">{t("alResetAllPw")}</option>
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="field w-auto">
            <option value="">{t("allTypes")}</option>
            <option value="quotation">{t("quotationsType")}</option>
            <option value="employee">{t("employeesType")}</option>
            <option value="settings">{t("settingsType")}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        {data.logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">{t("noLogs")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">{t("date")}</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("employee")}</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("actionCol")}</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("typeCol")}</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("detailsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 px-5 text-xs text-gray-400 font-mono-en whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="p-3 font-semibold">{log.employee.name}</td>
                  <td className="p-3">
                    <span className={cn("text-xs font-bold px-2 py-1 rounded-full", ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600")}>
                      {ACTION_KEYS[log.action] ? t(ACTION_KEYS[log.action]) : log.action}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{ENTITY_KEYS[log.entity] ? t(ENTITY_KEYS[log.entity]) : log.entity}</td>
                  <td className="p-3 text-xs text-gray-400 max-w-xs truncate">{log.details || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
