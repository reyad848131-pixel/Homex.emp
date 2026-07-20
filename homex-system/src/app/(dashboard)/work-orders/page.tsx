"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { WORK_STATUS_MAP } from "@/lib/types";
import {
  Truck,
  Search,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  X,
  Check,
  Filter,
} from "lucide-react";

interface WorkQuotation {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  notes: string | null;
  deliveryDate: string;
  workStatus: string | null;
  hasOrangeAlert: boolean;
  hasRedAlert: boolean;
  workNotes: string | null;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string };
  employee: { name: string };
  items: Array<{ description: string; quantity: number; category: { nameAr: string } }>;
}

function getDaysRemaining(deliveryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  return Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isAutoUrgent(deliveryDate: string, workStatus: string | null): boolean {
  if (workStatus === "delivered") return false;
  return getDaysRemaining(deliveryDate) <= 30;
}

function DaysRemainingBadge({ days, workStatus }: { days: number; workStatus: string | null }) {
  if (workStatus === "delivered") {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">تم التوصيل</span>;
  }
  if (days < 0) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">متأخر {Math.abs(days)} يوم</span>;
  }
  if (days === 0) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">اليوم!</span>;
  }
  if (days <= 7) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{days} يوم</span>;
  }
  if (days <= 30) {
    return <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{days} يوم</span>;
  }
  return <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{days} يوم</span>;
}

export default function WorkOrdersPage() {
  const [data, setData] = useState<{ quotations: WorkQuotation[]; counts: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (activeFilter) params.set("workStatus", activeFilter);
    if (alertFilter === "orange") params.set("hasOrange", "true");
    if (alertFilter === "red") params.set("hasRed", "true");
    if (search) params.set("search", search);
    if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
    if (deliveryTo) params.set("deliveryTo", deliveryTo);

    fetch(`/api/work-orders?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeFilter, alertFilter, search, deliveryFrom, deliveryTo]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (id: string, workStatus: string) => {
    await fetch("/api/work-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, workStatus }),
    });
    fetchData();
  };

  const handleAlertToggle = async (id: string, field: "hasOrangeAlert" | "hasRedAlert", current: boolean) => {
    await fetch("/api/work-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: !current }),
    });
    fetchData();
  };

  const handleSaveNotes = async (id: string) => {
    await fetch("/api/work-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, workNotes: notesText }),
    });
    setEditingNotes(null);
    fetchData();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "numeric" });

  if (loading && !data) {
    return <div className="text-center py-20 text-gray-400">جاري التحميل...</div>;
  }

  if (!data) {
    return <div className="text-center py-20 text-red-500">خطأ في تحميل البيانات</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="w-6 h-6" />
          إدارة الأعمال والتسليم
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors lg:hidden"
        >
          <Filter className="w-4 h-4" />
          فلترة
        </button>
      </div>

      {/* Status Cards — same style as dashboard */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Object.entries(WORK_STATUS_MAP).map(([key, s]) => {
          const count = data.counts[key] || 0;
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => { setActiveFilter(isActive ? null : key); setAlertFilter(null); }}
              className={cn(
                "border rounded p-3 text-center transition-all cursor-pointer",
                s.cardColor,
                isActive && "ring-2 ring-offset-1 ring-gray-900 dark:ring-gray-100"
              )}
            >
              <p className="text-2xl font-black font-mono-en">{count}</p>
              <p className="text-xs font-bold mt-0.5">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Alert Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setAlertFilter(alertFilter === "orange" ? null : "orange"); setActiveFilter(null); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-colors",
            alertFilter === "orange"
              ? "bg-orange-50 border-orange-300 text-orange-600"
              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-orange-300"
          )}
        >
          ملاحظة ({data.counts.orange || 0})
        </button>
        <button
          onClick={() => { setAlertFilter(alertFilter === "red" ? null : "red"); setActiveFilter(null); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-colors",
            alertFilter === "red"
              ? "bg-red-50 border-red-300 text-red-600"
              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-red-300"
          )}
        >
          مستعجل / متابعة ({data.counts.red || 0})
        </button>
        {(activeFilter || alertFilter) && (
          <button
            onClick={() => { setActiveFilter(null); setAlertFilter(null); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 transition-colors"
          >
            <X className="w-3 h-3" /> مسح الفلتر
          </button>
        )}
      </div>

      {/* Search & Date Filters */}
      <div className={cn("bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 mb-6", !showFilters && "max-lg:hidden")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث برقم العرض أو اسم العميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded px-4 py-2 pr-10 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={deliveryFrom}
              onChange={(e) => setDeliveryFrom(e.target.value)}
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded px-3 py-2 text-sm font-mono-en"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">إلى</span>
            <input
              type="date"
              value={deliveryTo}
              onChange={(e) => setDeliveryTo(e.target.value)}
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded px-3 py-2 text-sm font-mono-en"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {data.quotations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-12 text-center">
          <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">لا توجد طلبات{activeFilter || alertFilter ? " مطابقة للفلتر" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.quotations.map((q) => {
            const days = getDaysRemaining(q.deliveryDate);
            const autoUrgent = isAutoUrgent(q.deliveryDate, q.workStatus);
            const ws = q.workStatus ? WORK_STATUS_MAP[q.workStatus] : null;
            const isExpanded = expandedId === q.id;
            const itemSummary = q.items.slice(0, 3).map((it) => it.category.nameAr).join("، ");

            return (
              <div
                key={q.id}
                className={cn(
                  "bg-white dark:bg-gray-800 border rounded-lg overflow-hidden transition-all",
                  "border-gray-200 dark:border-gray-700",
                  (q.hasRedAlert || autoUrgent) && q.workStatus !== "delivered" && "border-red-300 dark:border-red-700"
                )}
              >
                {/* Main Row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/quotations/${q.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono-en font-bold text-sm text-gray-900 dark:text-white hover:underline"
                      >
                        {q.quoteNumber}
                      </Link>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{q.customer.name}</span>
                      {/* Status badge */}
                      {ws && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", ws.badgeColor)}>
                          {ws.label}
                        </span>
                      )}
                      {/* Alert badges */}
                      {q.hasOrangeAlert && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">ملاحظة</span>
                      )}
                      {(q.hasRedAlert || autoUrgent) && q.workStatus !== "delivered" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">مستعجل</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {itemSummary}{q.items.length > 3 ? ` +${q.items.length - 3}` : ""}
                    </p>
                  </div>

                  {/* Delivery Date & Days */}
                  <div className="text-left shrink-0 hidden sm:block">
                    <p className="text-xs text-gray-400 font-mono-en">{fmtDate(q.deliveryDate)}</p>
                    <div className="mt-1">
                      <DaysRemainingBadge days={days} workStatus={q.workStatus} />
                    </div>
                  </div>

                  {/* Expand */}
                  <div className="shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Mobile delivery info */}
                <div className="flex items-center justify-between px-4 pb-2 sm:hidden">
                  <p className="text-xs text-gray-400 font-mono-en">{fmtDate(q.deliveryDate)}</p>
                  <DaysRemainingBadge days={days} workStatus={q.workStatus} />
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400 font-bold mb-1">العميل</p>
                        <p className="text-sm font-semibold">{q.customer.name}</p>
                        <p className="text-xs text-gray-500 font-mono-en">{q.customer.phoneCode} {q.customer.phone}</p>
                        <p className="text-xs text-gray-500">{q.customer.governorate} – {q.customer.wilayat}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-bold mb-1">تفاصيل الطلب</p>
                        <p className="text-xs text-gray-500">الموظف: {q.employee.name}</p>
                        <p className="text-xs text-gray-500">المجموع: <span className="font-mono-en font-bold">{q.total.toFixed(3)} ر.ع</span></p>
                        <p className="text-xs text-gray-500">عدد البنود: {q.items.length}</p>
                      </div>
                    </div>

                    {/* Items summary */}
                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-1">البنود</p>
                      <div className="space-y-1">
                        {q.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-mono-en">{i + 1}.</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.description}</span>
                            <span className="text-gray-400">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Work Status Change */}
                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-2">تغيير حالة العمل</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(WORK_STATUS_MAP).map(([key, s]) => (
                          <button
                            key={key}
                            onClick={() => handleStatusChange(q.id, key)}
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                              q.workStatus === key
                                ? cn(s.cardColor, "ring-1 ring-offset-1 ring-gray-400")
                                : "border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-400"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Alert Toggles */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleAlertToggle(q.id, "hasOrangeAlert", q.hasOrangeAlert)}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                          q.hasOrangeAlert
                            ? "bg-orange-50 border-orange-300 text-orange-600"
                            : "border-gray-200 dark:border-gray-600 text-gray-500"
                        )}
                      >
                        {q.hasOrangeAlert ? "إزالة الملاحظة" : "إضافة ملاحظة"}
                      </button>
                      <button
                        onClick={() => handleAlertToggle(q.id, "hasRedAlert", q.hasRedAlert)}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                          q.hasRedAlert
                            ? "bg-red-50 border-red-300 text-red-600"
                            : "border-gray-200 dark:border-gray-600 text-gray-500"
                        )}
                      >
                        {q.hasRedAlert ? "إزالة الاستعجال" : "تحديد مستعجل"}
                      </button>
                      {autoUrgent && q.workStatus !== "delivered" && !q.hasRedAlert && (
                        <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          تنبيه تلقائي — أقل من شهر
                        </span>
                      )}
                    </div>

                    {/* Work Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> ملاحظات العمل
                        </p>
                        {editingNotes !== q.id && (
                          <button
                            onClick={() => { setEditingNotes(q.id); setNotesText(q.workNotes || ""); }}
                            className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold"
                          >
                            تعديل
                          </button>
                        )}
                      </div>
                      {editingNotes === q.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded px-3 py-2 text-sm min-h-[80px]"
                            placeholder="أضف ملاحظات العمل هنا..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNotes(q.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white rounded text-xs font-bold"
                            >
                              <Check className="w-3 h-3" /> حفظ
                            </button>
                            <button
                              onClick={() => setEditingNotes(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {q.workNotes || <span className="text-gray-400 dark:text-gray-500 italic">لا توجد ملاحظات</span>}
                        </p>
                      )}
                    </div>

                    {/* Link to Quotation */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        فتح عرض السعر الأصلي
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
