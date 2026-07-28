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

const WORK_STATUS_OPTIONS = Object.entries(WORK_STATUS_MAP).map(([key, v]) => ({ key, label: v.label }));

interface PreviewResult {
  headers: string[];
  totalRows: number;
  yearRows: number;
  validCount: number;
  errorCount: number;
  noDateRows: number;
  headerRow: number;
  mapping: Record<string, string>;
  statusMap: Record<string, string>;
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
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [headerRow, setHeaderRow] = useState<number>(1);
  // Comma/space separated years to include (empty = all years).
  const [yearsInput, setYearsInput] = useState("2025, 2026");
  // Also bring in rows that have no readable date (in-progress orders).
  const [includeUndated, setIncludeUndated] = useState(false);
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

  const runPreview = useCallback(async (f: File, map: Record<string, string>, years: number[], sMap: Record<string, string>, dws: string, hRow?: number, undated?: boolean) => {
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("payload", JSON.stringify({ action: "preview", mapping: map, years, statusMap: sMap, defaultWorkStatus: dws, headerRow: hRow, includeUndated: !!undated }));
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل التحليل"); return; }
      setPreview(data);
      setHeaders(data.headers || []);
      // Adopt the server's detected header row and effective (auto) mapping so
      // the dropdowns reflect what was matched.
      if (typeof data.headerRow === "number") setHeaderRow(data.headerRow);
      if (data.mapping) setMapping(data.mapping);
      // Adopt the server's auto-classified status mapping (typo-tolerant).
      if (data.statusMap) setStatusMap(data.statusMap);
    } catch {
      toast.error("تعذّر قراءة الملف");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const parseYears = (s: string): number[] =>
    Array.from(new Set((s.match(/\d{4}/g) || []).map(Number)));

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setMapping({});
    // First pass: let the server auto-detect the header row + mapping.
    if (f) runPreview(f, {}, parseYears(yearsInput), {}, defaultWorkStatus, undefined, includeUndated);
  };

  const reprocess = () => { if (file) runPreview(file, mapping, parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, includeUndated); };

  const commit = async () => {
    if (!file || !preview) return;
    if (!confirm(`سيتم استيراد ${preview.validCount} طلب. متابعة؟`)) return;
    setCommitting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("payload", JSON.stringify({ action: "commit", mapping, years: parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, includeUndated }));
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
          <label className="text-sm font-semibold text-gray-500">سنوات الطلبات:</label>
          <input type="text" value={yearsInput} onChange={(e) => setYearsInput(e.target.value)}
            onBlur={reprocess} className="field w-40 h-11 font-mono-en" placeholder="الكل (اتركها فارغة)" />
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={includeUndated}
              onChange={(e) => { setIncludeUndated(e.target.checked); if (file) runPreview(file, mapping, parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, e.target.checked); }}
              className="w-4 h-4 accent-gray-900" />
            ضمّن الصفوف بدون تاريخ
          </label>
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
              { label: `طلبات ${parseYears(yearsInput).length ? parseYears(yearsInput).join("، ") : "الكل"}`, value: preview.yearRows, tone: "text-gray-900 dark:text-white" },
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

          {preview.fileDuplicates.length > 0 && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-5 text-sm">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-blue-800 dark:text-blue-200">
                <span className="font-bold font-mono-en">{preview.fileDuplicates.length}</span> رقم طلب مكرّر داخل الملف — <b>كل الصفوف تُحفظ</b> (المكرر ياخذ لاحقة مثل «-2»، والرقم الأصلي يُسجَّل في الملاحظات).
              </p>
            </div>
          )}

          {preview.noDateRows > 0 && (
            <div className={`flex items-start gap-2 rounded-xl p-4 mb-5 text-sm border ${includeUndated ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${includeUndated ? "text-emerald-600" : "text-amber-600"}`} />
              <p className={includeUndated ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}>
                <span className="font-bold font-mono-en">{preview.noDateRows}</span> صف بدون تاريخ تسليم ولا حجز مقروء.
                {includeUndated
                  ? " ✓ مُضمَّنة الآن (تدخل إدارة الأعمال بدون تاريخ)."
                  : " لن تُحسب ضمن أي سنة — فعّل «ضمّن الصفوف بدون تاريخ» أعلاه لإدخالها."}
              </p>
            </div>
          )}

          {/* Column mapping */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h2 className="font-bold">ربط الأعمدة</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500">صف العناوين:</label>
                <input type="number" min={1} value={headerRow}
                  onChange={(e) => setHeaderRow(Math.max(1, +e.target.value || 1))} onBlur={reprocess}
                  className="field w-20 h-9 font-mono-en text-xs" />
              </div>
            </div>
            {headers.length > 0 && (
              <p className="text-xs text-gray-400 mb-3">الأعمدة المكتشفة: <span className="font-mono-en">{headers.join(" · ")}</span></p>
            )}
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
