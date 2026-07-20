"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { STATUS_MAP } from "@/lib/types";
import { Search, FilePlus, Filter, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Quotation {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  createdAt: string;
  customer: { name: string; phone: string; governorate: string };
  employee: { name: string };
  _count: { items: number };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fmtCur = (n: number) => `${n.toFixed(3)} ر.ع`;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/quotations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setQuotations(data.quotations || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  const statuses = ["all", ...Object.keys(STATUS_MAP)];
  const statusLabels: Record<string, string> = { all: "الكل", ...Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])) };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">عروض الأسعار</h1>
          <p className="text-sm text-gray-500 mt-1">{total} عرض سعر</p>
        </div>
        <Link href="/quotations/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 transition-colors">
          <FilePlus className="w-4 h-4" />
          عرض سعر جديد
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded pr-10 pl-3 py-2.5 text-sm"
              placeholder="بحث برقم العرض، اسم العميل، أو الهاتف..." />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-colors border",
                  statusFilter === s
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-400")}>
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">جاري التحميل...</div>
        ) : quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">لا توجد نتائج</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">رقم العرض</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">العميل</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">المنطقة</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">البنود</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">الحالة</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">المجموع</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => {
                  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
                  return (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 px-5">
                        <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold">{q.customer.name}</p>
                        <p className="text-xs text-gray-400 font-mono-en">{q.customer.phone}</p>
                      </td>
                      <td className="p-3 text-gray-500">{q.customer.governorate}</td>
                      <td className="p-3 font-mono-en text-gray-500">{q._count.items}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono-en font-bold">{fmtCur(q.total)}</td>
                      <td className="p-3 text-gray-400 font-mono-en text-xs">
                        {new Date(q.createdAt).toLocaleDateString("ar-OM")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            عرض {(page - 1) * limit + 1} - {Math.min(page * limit, total)} من {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              السابق
            </button>
            <span className="flex items-center px-3 text-sm text-gray-500 font-mono-en">
              {page} / {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
              disabled={page >= Math.ceil(total / limit)}
              className="px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
