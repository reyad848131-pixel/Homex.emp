"use client";

import { useState, useEffect } from "react";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  employee: { name: string };
}

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  status_change: "تغيير حالة",
};

const ENTITY_LABELS: Record<string, string> = {
  quotation: "عرض سعر",
  employee: "موظف",
  settings: "إعدادات",
  customer: "عميل",
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

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (entity) params.set("entity", entity);
    fetch(`/api/audit-logs?${params}`).then((r) => r.json()).then(setData);
  }, [page, entity]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="w-6 h-6" />
            سجل النشاطات
          </h1>
          <p className="text-sm text-gray-500 mt-1">{data.total} سجل</p>
        </div>
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded px-3 py-2 text-sm">
          <option value="">جميع الأنواع</option>
          <option value="quotation">عروض الأسعار</option>
          <option value="employee">الموظفين</option>
          <option value="settings">الإعدادات</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        {data.logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">لا توجد سجلات</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">التاريخ</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">الموظف</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">الإجراء</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">النوع</th>
                <th className="text-right p-3 text-xs text-gray-400 font-semibold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 px-5 text-xs text-gray-400 font-mono-en whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("ar-OM", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="p-3 font-semibold">{log.employee.name}</td>
                  <td className="p-3">
                    <span className={cn("text-xs font-bold px-2 py-1 rounded-full", ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600")}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{ENTITY_LABELS[log.entity] || log.entity}</td>
                  <td className="p-3 text-xs text-gray-400 max-w-xs truncate">{log.details || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm font-bold disabled:opacity-30">السابق</button>
          <span className="text-sm text-gray-500 font-mono-en">{page} / {data.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm font-bold disabled:opacity-30">التالي</button>
        </div>
      )}
    </div>
  );
}
