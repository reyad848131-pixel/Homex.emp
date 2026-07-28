"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertTriangle, RotateCcw, Loader2, ArrowRight } from "lucide-react";
import { WORK_STATUS_MAP } from "@/lib/types";
import { useToast } from "@/components/toast";

// Import fields (kept in sync with src/lib/import.ts) with Arabic labels.
const FIELDS: Array<{ key: string; label: string; hint?: string }> = [
  { key: "orderNumber", label: "رقم الطلب", hint: "يُحفظ كرقم العرض" },
  { key: "name", label: "اسم العميل" },
  { key: "phone", label: "الهاتف" },
  { key: "place", label: "المنطقة" },
  { key: "total", label: "الإجمالي" },
  { key: "advance", label: "المدفوع (دفعة مقدمة)" },
  { key: "deliveryDate", label: "تاريخ التسليم", hint: "يحدّد السنة أيضاً" },
  { key: "deliveredOn", label: "تاريخ التسليم الفعلي" },
  { key: "workStatus", label: "الحالة" },
  { key: "description", label: "الوصف" },
  { key: "remarks", label: "ملاحظات" },
];

const DEFAULT_MAPPING: Record<string, string> = {
  orderNumber: "Advance Bill No.", name: "Name", phone: "Phone", place: "Place",
  total: "Total Price", advance: "Advance", deliveryDate: "Delivery date",
  deliveredOn: "del.date", workStatus: "Work Status", description: "Melboard", remarks: "Remarks",
};

const WORK_STATUS_OPTIONS = Object.entries(WORK_STATUS_MAP).map(([key, v]) => ({ key, label: v.label }));

interface PreviewResult {
  headers: string[];
  totalRows: number;
  yearRows: number;
  validCount: number;
  errorCount: number;
  distinctStatuses: Array<{ raw: string; count: number }>;
  fileDuplicates: string[];
  sample: Array<{
    rowNumber: number; orderNumber: string; name: string; phone: string; place: string;
    total: number; advance: number; deliveryDate: string | null;
    workStatusRaw: string; systemWorkStatus: string; errors: string[];
  }>;
}

const ERR_LABEL: Record<string, string> = {
  missing_name: "بدون اسم", missing_phone: "بدون هاتف",
  missing_order_number: "بدون رقم طلب", order_number_exists: "الرقم موجود مسبقاً",
};

export default function ImportPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>(DEFAULT_MAPPING);
  const [year, setYear] = useState<number | "">(2026);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [defaultWorkStatus, setDefaultWorkStatus] = useState("in_progress");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skippedCount: number } | null>(null);
  const [batches, setBatches] = useState<Array<{ batch: string; count: number; at: string }>>([]);

  const loadBatches = useCallback(() => {
    fetch("/api/import").then((r) => (r.ok ? r.json() : { batches: [] })).then((d) => setBatches(d.batches || [])).catch(() => {});
  }, []);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  const runPreview = useCallback(async (f: File, map: Record<string, string>, yr: number | "", sMap: Record<string, string>, dws: string) => {
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("payload", JSON.stringify({ action: "preview", mapping: map, year: yr === "" ? null : yr, statusMap: sMap, defaultWorkStatus: dws }));
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل التحليل"); return; }
      setPreview(data);
      setHeaders(data.headers || []);
      // Seed status mapping for any new raw statuses (smart defaults).
      setStatusMap((prev) => {
        const next = { ...prev };
        for (const s of data.distinctStatuses as Array<{ raw: string }>) {
          if (next[s.raw]) continue;
          const raw = s.raw.toLowerCase();
          next[s.raw] = raw.includes("deliver") && raw.includes("done") ? "delivered"
            : raw.includes("install") ? "installed"
            : raw.includes("ready") ? "ready_for_delivery"
            : "in_progress";
        }
        return next;
      });
    } catch {
      toast.error("تعذّر قراءة الملف");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    if (f) runPreview(f, mapping, year, {}, defaultWorkStatus);
  };

  const reprocess = () => { if (file) runPreview(file, mapping, year, statusMap, defaultWorkStatus); };

  const commit = async () => {
    if (!file || !preview) return;
    if (!confirm(`سيتم استيراد ${preview.validCount} طلب. متابعة؟`)) return;
    setCommitting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("payload", JSON.stringify({ action: "commit", mapping, year: year === "" ? null : year, statusMap, defaultWorkStatus }));
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل الاستيراد"); return; }
      setResult({ created: data.created, skippedCount: data.skippedCount });
      toast.success(`تم استيراد ${data.created} طلب`);
      loadBatches();
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast.error("تعذّر الاستيراد");
    } finally {
      setCommitting(false);
    }
  };

  const undo = async (batch: string) => {
    if (!confirm("حذف كل طلبات وعملاء هذه الدفعة نهائياً؟")) return;
    try {
      const res = await fetch(`/api/import?batch=${encodeURIComponent(batch)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل التراجع"); return; }
      toast.success(`تم حذف ${data.quotations} طلب`);
      loadBatches();
    } catch {
      toast.error("تعذّر التراجع");
    }
  };

  const fmtCur = (n: number) => `${n.toFixed(3)}`;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="w-6 h-6" /> استيراد من إكسل</h1>
        <p className="text-sm text-gray-500 mt-1">استورد جدول التوصيل القديم إلى إدارة الأعمال — مع معاينة قبل الحفظ وإمكانية التراجع.</p>
      </div>

      {/* Upload */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold">
            <Upload className="w-4 h-4" /> اختر ملف إكسل (.xlsx)
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] || null)} />
          {file && <span className="text-sm text-gray-500 font-mono-en">{file.name}</span>}
          <div className="flex-1" />
          <label className="text-sm font-semibold text-gray-500">سنة الطلبات:</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value === "" ? "" : +e.target.value)}
            onBlur={reprocess} className="field w-28 h-11 font-mono-en" placeholder="الكل" />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-5"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحليل...</div>
      )}

      {preview && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: `طلبات ${year || "الكل"}`, value: preview.yearRows, tone: "text-gray-900 dark:text-white" },
              { label: "صالحة للاستيراد", value: preview.validCount, tone: "text-emerald-600" },
              { label: "بها أخطاء", value: preview.errorCount, tone: "text-red-600" },
              { label: "إجمالي صفوف الملف", value: preview.totalRows, tone: "text-gray-400" },
            ].map((k, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                <p className="text-[11px] text-gray-400 font-semibold mb-1">{k.label}</p>
                <p className={`text-2xl font-black font-mono-en ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Column mapping */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
            <h2 className="font-bold mb-3">ربط الأعمدة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}{f.hint && <span className="text-gray-400 font-normal"> — {f.hint}</span>}</label>
                  <select value={mapping[f.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="field h-9 text-xs">
                    <option value="">— بدون —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={reprocess} className="mt-4 inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700">
              <RotateCcw className="w-4 h-4" /> إعادة المعاينة
            </button>
          </div>

          {/* Status mapping */}
          {preview.distinctStatuses.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
              <h2 className="font-bold mb-3">تحويل الحالة → حالة العمل في النظام</h2>
              <div className="space-y-2">
                {preview.distinctStatuses.map((s) => (
                  <div key={s.raw} className="flex items-center gap-3">
                    <span className="text-sm font-semibold min-w-[140px] truncate">{s.raw} <span className="text-gray-400 font-mono-en">({s.count})</span></span>
                    <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <select value={statusMap[s.raw] || defaultWorkStatus} onChange={(e) => setStatusMap((m) => ({ ...m, [s.raw]: e.target.value }))}
                      className="field h-9 text-xs flex-1 max-w-xs">
                      {WORK_STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">الطلبات غير المسلَّمة تدخل إدارة الأعمال، وتنتقل لقائمة التوصيل/التصوير حسب حالتها.</p>
            </div>
          )}

          {/* Sample preview */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-5">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700"><h2 className="font-bold">معاينة (أول {preview.sample.length} صف)</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 text-gray-400">
                    <th className="text-right p-2 px-3 font-semibold">رقم الطلب</th>
                    <th className="text-right p-2 font-semibold">العميل</th>
                    <th className="text-right p-2 font-semibold">الهاتف</th>
                    <th className="text-right p-2 font-semibold">المنطقة</th>
                    <th className="text-right p-2 font-semibold">الإجمالي</th>
                    <th className="text-right p-2 font-semibold">التسليم</th>
                    <th className="text-right p-2 font-semibold">الحالة</th>
                    <th className="text-right p-2 font-semibold">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => {
                    const ws = WORK_STATUS_MAP[r.systemWorkStatus];
                    const bad = r.errors.length > 0;
                    return (
                      <tr key={r.rowNumber} className={`border-b border-gray-50 dark:border-gray-700/50 ${bad ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                        <td className="p-2 px-3 font-mono-en font-bold">{r.orderNumber || "—"}</td>
                        <td className="p-2">{r.name || "—"}</td>
                        <td className="p-2 font-mono-en">{r.phone || "—"}</td>
                        <td className="p-2">{r.place || "—"}</td>
                        <td className="p-2 font-mono-en">{fmtCur(r.total)}</td>
                        <td className="p-2 font-mono-en">{r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString("en-GB") : "—"}</td>
                        <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ws?.badgeColor || "bg-gray-100 text-gray-600"}`}>{ws?.label || r.systemWorkStatus}</span></td>
                        <td className="p-2">
                          {bad && <span className="inline-flex items-center gap-1 text-red-600 text-[11px] font-bold"><AlertTriangle className="w-3 h-3" /> {r.errors.map((e) => ERR_LABEL[e] || e).join("، ")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commit */}
          <div className="flex items-center gap-3 mb-8">
            <button onClick={commit} disabled={committing || preview.validCount === 0}
              className="inline-flex items-center gap-2 px-6 h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50">
              {committing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              استيراد {preview.validCount} طلب إلى إدارة الأعمال
            </button>
            <span className="text-xs text-gray-400">الصفوف التي بها أخطاء تُتخطّى تلقائياً.</span>
          </div>
        </>
      )}

      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 mb-5">
          <p className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"><Check className="w-5 h-5" /> تم استيراد {result.created} طلب.</p>
          {result.skippedCount > 0 && <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">تم تخطّي {result.skippedCount} صف (أخطاء أو تكرار).</p>}
        </div>
      )}

      {/* Batches / undo */}
      {batches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h2 className="font-bold mb-3">دفعات الاستيراد السابقة</h2>
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.batch} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-bold font-mono-en">{b.batch}</p>
                  <p className="text-xs text-gray-400"><span className="font-mono-en">{b.count}</span> طلب · {new Date(b.at).toLocaleString("en-GB")}</p>
                </div>
                <button onClick={() => undo(b.batch)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20">
                  <RotateCcw className="w-3.5 h-3.5" /> تراجع (حذف الدفعة)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
