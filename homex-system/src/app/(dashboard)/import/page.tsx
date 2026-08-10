"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertTriangle, RotateCcw, Loader2, ArrowRight, Lock, Zap } from "lucide-react";
import { WORK_STATUS_MAP } from "@/lib/types";
import { useToast } from "@/components/toast";
import { useI18n, type TranslationKey } from "@/lib/i18n";

// Import fields (kept in sync with src/lib/import.ts) — labels resolved by locale.
const FIELDS: Array<{ key: string; ar: string; en: string; arHint?: string; enHint?: string }> = [
  { key: "orderNumber", ar: "رقم الطلب", en: "Order number", arHint: "يُحفظ كرقم العرض", enHint: "Saved as the quote number" },
  { key: "name", ar: "اسم العميل", en: "Customer name" },
  { key: "phone", ar: "الهاتف", en: "Phone" },
  { key: "place", ar: "المنطقة", en: "Area" },
  { key: "total", ar: "الإجمالي", en: "Total" },
  { key: "advance", ar: "المدفوع (دفعة مقدمة)", en: "Paid (advance)" },
  { key: "deliveryDate", ar: "تاريخ التسليم", en: "Delivery date", arHint: "يحدّد السنة أيضاً", enHint: "Also sets the year" },
  { key: "deliveredOn", ar: "تاريخ التسليم الفعلي", en: "Actual delivery date" },
  { key: "workStatus", ar: "الحالة", en: "Status" },
  { key: "description", ar: "الوصف", en: "Description" },
  { key: "remarks", ar: "ملاحظات", en: "Remarks" },
];

// Work-status option keys → translation keys (mirrors the work board).
const WS_KEYS: Record<string, TranslationKey> = {
  needs_preparation: "needsPreparation",
  ready_to_execute: "readyToExecute",
  in_progress: "inProgress",
  completed: "completed",
  ready_for_delivery: "readyForDelivery",
  delivered: "delivered",
};
const WORK_STATUS_OPTIONS = Object.keys(WORK_STATUS_MAP).map((key) => ({ key }));

interface PreviewResult {
  headers: string[];
  totalRows: number;
  yearRows: number;
  validCount: number;
  errorCount: number;
  alreadyExists: number;
  alreadyInTrash: number;
  noiseRows: number;
  noDateRows: number;
  estimatedDateRows: number;
  headerRow: number;
  sheets: string[];
  sheetName: string;
  mapping: Record<string, string>;
  statusMap: Record<string, string>;
  distinctStatuses: Array<{ raw: string; count: number }>;
  fileDuplicates: string[];
  sample: Array<{
    rowNumber: number; orderNumber: string; name: string; phone: string; place: string;
    total: number; advance: number; deliveryDate: string | null; deliveryDateEstimated: boolean;
    workStatusRaw: string; systemWorkStatus: string; errors: string[];
  }>;
}

interface ConflictsResult {
  checked: number;
  matched: number;
  conflictsCount: number;
  conflicts: Array<{ id: string; quoteNumber: string; sheetName: string; systemName: string; phone: string; place: string; deliveryDate: string | null }>;
}

const ERR_LABEL: Record<string, { ar: string; en: string }> = {
  missing_name: { ar: "بدون اسم", en: "No name" },
  missing_phone: { ar: "بدون هاتف", en: "No phone" },
  missing_order_number: { ar: "بدون رقم طلب", en: "No order number" },
  order_number_exists: { ar: "الرقم موجود مسبقاً", en: "Number already exists" },
  order_in_trash: { ar: "محذوف (في المهملات)", en: "Deleted (in trash)" },
  db_error: { ar: "خطأ في الحفظ", en: "Save error" },
  duplicate_in_file: { ar: "مكرر في الملف", en: "Duplicate in file" },
};

export default function ImportPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const L = (ar: string, en: string) => (locale === "en" ? en : ar);
  const errLabel = (key: string) => (ERR_LABEL[key] ? L(ERR_LABEL[key].ar, ERR_LABEL[key].en) : key);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  // Comma/space separated years to include (empty = all years).
  const [yearsInput, setYearsInput] = useState("2025, 2026");
  // Also bring in rows that have no readable date (in-progress orders), and the
  // work status to force on them.
  const [includeUndated, setIncludeUndated] = useState(false);
  const [undatedStatus, setUndatedStatus] = useState("delivered");
  // Import as editable drafts + keep the sheet total as a reference, so items
  // can be filled in manually and checked against it (for 2026 orders).
  const [editableDraft, setEditableDraft] = useState(false);
  // Generate a number for rows that have none (instead of skipping them).
  const [autoNumber, setAutoNumber] = useState(false);
  const autoNumberRef = useRef(false);
  // Import every row even if incomplete (placeholders for missing name/phone/number).
  const [importIncomplete, setImportIncomplete] = useState(false);
  const importIncompleteRef = useRef(false);
  // Estimate a delivery date for rows that have none, from neighbouring rows,
  // so they sort into the right place (flagged "تقديري", entered manually).
  const [estimateDates, setEstimateDates] = useState(true);
  const estimateDatesRef = useRef(true);
  // Post-import name-conflict report (row name vs linked customer name).
  const [conflicts, setConflicts] = useState<ConflictsResult | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [defaultWorkStatus, setDefaultWorkStatus] = useState("in_progress");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skippedCount: number; reasonCounts?: Record<string, number>; skipped?: Array<{ row: number; order: string; reason: string }> } | null>(null);
  const [batches, setBatches] = useState<Array<{ batch: string; count: number; at: string }>>([]);

  // Private import passcode (independent of roles). While a passcode is set the
  // page stays locked until it's entered; the verified value is sent with every
  // import request.
  const [passSet, setPassSet] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");        // verified passcode kept for headers
  const [passInput, setPassInput] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [showSetPass, setShowSetPass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [curPass, setCurPass] = useState("");
  // Owner-only recovery key: set alongside the passcode, used to reset it if
  // forgotten (no current passcode needed).
  const [hasRecovery, setHasRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetRecovery, setResetRecovery] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");

  const ihdr = useCallback((): Record<string, string> => (pass ? { "x-import-passcode": pass } : {}), [pass]);

  const loadBatches = useCallback(() => {
    fetch("/api/import", { headers: ihdr() }).then((r) => (r.ok ? r.json() : { batches: [] })).then((d) => setBatches(d.batches || [])).catch(() => {});
  }, [ihdr]);

  // On mount: is a passcode configured? If not, the page is open; if yes, lock.
  useEffect(() => {
    fetch("/api/import/passcode").then((r) => (r.ok ? r.json() : { isSet: false })).then((d) => {
      setPassSet(!!d.isSet);
      setHasRecovery(!!d.hasRecovery);
      if (!d.isSet) { setUnlocked(true); }
    }).catch(() => { setPassSet(false); setUnlocked(true); });
  }, []);

  useEffect(() => { if (unlocked) loadBatches(); }, [unlocked, loadBatches]);

  const unlock = async () => {
    if (!passInput) return;
    setPassBusy(true);
    try {
      const res = await fetch("/api/import/passcode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", passcode: passInput }),
      });
      const data = await res.json();
      if (data.ok) { setPass(passInput); setPassInput(""); setUnlocked(true); }
      else toast.error(L("كلمة السر غير صحيحة", "Incorrect passcode"));
    } catch { toast.error(L("تعذّر التحقق", "Verification failed")); }
    finally { setPassBusy(false); }
  };

  const savePasscode = async () => {
    if (newPass.length < 4) { toast.error(L("كلمة السر قصيرة (4 أحرف على الأقل)", "Passcode too short (at least 4 characters)")); return; }
    if (recoveryKey && recoveryKey.length < 8) { toast.error(L("مفتاح الاسترجاع قصير (8 أحرف على الأقل)", "Recovery key too short (at least 8 characters)")); return; }
    setPassBusy(true);
    try {
      const res = await fetch("/api/import/passcode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", newPasscode: newPass, currentPasscode: curPass, recoveryKey: recoveryKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل الحفظ", "Save failed")); return; }
      toast.success(L("تم حفظ كلمة سر الاستيراد", "Import passcode saved"));
      setPass(newPass); setPassSet(true); setUnlocked(true);
      if (recoveryKey) setHasRecovery(true);
      setShowSetPass(false); setNewPass(""); setCurPass(""); setRecoveryKey("");
    } catch { toast.error(L("تعذّر الحفظ", "Couldn't save")); }
    finally { setPassBusy(false); }
  };

  const resetPasscode = async () => {
    if (!resetRecovery) { toast.error(L("أدخل مفتاح الاسترجاع", "Enter the recovery key")); return; }
    if (resetNewPass.length < 4) { toast.error(L("كلمة السر الجديدة قصيرة (4 أحرف على الأقل)", "New passcode too short (at least 4 characters)")); return; }
    setPassBusy(true);
    try {
      const res = await fetch("/api/import/passcode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", recoveryKey: resetRecovery, newPasscode: resetNewPass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل الاسترجاع", "Reset failed")); return; }
      toast.success(L("تم تعيين كلمة سر جديدة", "New passcode set"));
      setPass(resetNewPass); setUnlocked(true);
      setShowReset(false); setResetRecovery(""); setResetNewPass("");
    } catch { toast.error(L("تعذّر الاسترجاع", "Couldn't reset")); }
    finally { setPassBusy(false); }
  };

  const runPreview = useCallback(async (f: File, map: Record<string, string>, years: number[], sMap: Record<string, string>, dws: string, hRow?: number, undated?: boolean, uStatus?: string, sheet?: string) => {
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("payload", JSON.stringify({ action: "preview", mapping: map, years, statusMap: sMap, defaultWorkStatus: dws, headerRow: hRow, includeUndated: !!undated, undatedStatus: uStatus, sheetName: sheet, autoNumber: autoNumberRef.current, importIncomplete: importIncompleteRef.current, estimateDates: estimateDatesRef.current }));
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd, headers: ihdr() });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل التحليل", "Analysis failed")); return; }
      setPreview(data);
      setHeaders(data.headers || []);
      // Adopt the server's detected header row and effective (auto) mapping so
      // the dropdowns reflect what was matched.
      if (typeof data.headerRow === "number") setHeaderRow(data.headerRow);
      if (data.sheets) setSheets(data.sheets);
      if (data.sheetName) setSheetName(data.sheetName);
      if (data.mapping) setMapping(data.mapping);
      // Adopt the server's auto-classified status mapping (typo-tolerant).
      if (data.statusMap) setStatusMap(data.statusMap);
    } catch {
      toast.error(L("تعذّر قراءة الملف", "Couldn't read the file"));
    } finally {
      setLoading(false);
    }
  }, [toast, ihdr]);

  const parseYears = (s: string): number[] =>
    Array.from(new Set((s.match(/\d{4}/g) || []).map(Number)));

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setMapping({});
    // First pass: let the server auto-detect the sheet, header row + mapping.
    setSheetName(""); setSheets([]);
    if (f) runPreview(f, {}, parseYears(yearsInput), {}, defaultWorkStatus, undefined, includeUndated, undatedStatus, undefined);
  };

  const reprocess = () => { if (file) runPreview(file, mapping, parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, includeUndated, undatedStatus, sheetName); };

  // One-click preset for the company's BRS delivery-schedule workbook: target the
  // 2026 tab, auto-number the few bill-less orders, and keep every "loosen"
  // toggle off so only real, dated orders come in cleanly (the repeated
  // header/banner/legend rows are dropped automatically by the server).
  const applyBrsPreset = () => {
    autoNumberRef.current = true; setAutoNumber(true);
    importIncompleteRef.current = false; setImportIncomplete(false);
    // Keep date-estimation ON: many 2026 orders are booked ahead with an empty
    // delivery date, so without it they fall back to their 2025 booking year and
    // drop out of the 2026 filter. Estimation slots them into 2026 (flagged
    // "تقديري" for manual confirmation).
    estimateDatesRef.current = true; setEstimateDates(true);
    setIncludeUndated(false);
    // Import as editable drafts and keep the sheet total as a reference, so staff
    // can add the customer's item lines (with prices) into each quotation later
    // and check the built-up total against it.
    setEditableDraft(true);
    setYearsInput("2026");
    const brsSheet = sheets.find((s) => /\b26\b|26\s*$/.test(s)) || sheets.find((s) => s.includes("26"));
    if (file) {
      setMapping({});
      runPreview(file, {}, [2026], {}, defaultWorkStatus, undefined, false, undatedStatus, brsSheet || undefined);
      toast.success(L("تم ضبط إعدادات دفتر BRS لسنة 2026 — راجع المعاينة ثم اعتمد", "BRS workbook set for 2026 — review the preview then commit"));
    } else {
      toast.success(L("تم الضبط — اختر ملف الإكسل الآن", "Configured — now choose the Excel file"));
    }
  };

  // Switching tabs re-detects the header row + mapping for that sheet.
  const changeSheet = (name: string) => {
    setSheetName(name); setMapping({});
    if (file) runPreview(file, {}, parseYears(yearsInput), {}, defaultWorkStatus, undefined, includeUndated, undatedStatus, name);
  };

  const runConflicts = async () => {
    if (!file) { toast.error(L("اختر ملف الإكسل الذي استوردته أولاً", "Choose the Excel file you imported first")); return; }
    setConflictBusy(true);
    setConflicts(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("payload", JSON.stringify({ action: "conflicts", mapping, headerRow, sheetName, estimateDates }));
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd, headers: ihdr() });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل الفحص", "Scan failed")); return; }
      setConflicts(data);
      if (data.conflictsCount === 0) toast.success(L("لا يوجد تعارض في الأسماء ✓", "No name conflicts ✓"));
    } catch {
      toast.error(L("تعذّر الفحص", "Couldn't scan"));
    } finally {
      setConflictBusy(false);
    }
  };

  const commit = async () => {
    if (!file || !preview) return;
    if (!confirm(L(`سيتم استيراد ${preview.validCount} طلب. متابعة؟`, `${preview.validCount} orders will be imported. Continue?`))) return;
    setCommitting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("payload", JSON.stringify({ action: "commit", mapping, years: parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, includeUndated, undatedStatus, editableDraft, sheetName, autoNumber, importIncomplete, estimateDates }));
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd, headers: ihdr() });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل الاستيراد", "Import failed")); return; }
      setResult({ created: data.created, skippedCount: data.skippedCount, reasonCounts: data.reasonCounts, skipped: data.skipped });
      toast.success(L(`تم استيراد ${data.created} طلب`, `Imported ${data.created} orders`));
      loadBatches();
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast.error(L("تعذّر الاستيراد", "Couldn't import"));
    } finally {
      setCommitting(false);
    }
  };

  const undo = async (batch: string) => {
    if (!confirm(L("حذف كل طلبات وعملاء هذه الدفعة نهائياً؟", "Permanently delete all orders and customers in this batch?"))) return;
    try {
      const res = await fetch(`/api/import?batch=${encodeURIComponent(batch)}`, { method: "DELETE", headers: ihdr() });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل التراجع", "Undo failed")); return; }
      toast.success(L(`تم حذف ${data.quotations} طلب`, `Deleted ${data.quotations} orders`));
      loadBatches();
    } catch {
      toast.error(L("تعذّر التراجع", "Couldn't undo"));
    }
  };

  const [renumBusy, setRenumBusy] = useState("");
  const renumberBatch = async (batch: string) => {
    if (!confirm(L("توحيد ترقيم كل طلبات هذه الدفعة إلى نمط HX-YYYY-####؟\nرقمك القديم (SW-###) يُحفظ كرقم مرجعي على كل طلب.", "Renumber all orders in this batch to the HX-YYYY-#### pattern?\nYour old number (SW-###) is kept as a reference on each order."))) return;
    setRenumBusy(batch);
    try {
      const res = await fetch("/api/import/renumber", {
        method: "POST", headers: { "Content-Type": "application/json", ...ihdr() },
        body: JSON.stringify({ batch }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || L("فشل التوحيد", "Renumber failed")); return; }
      toast.success(L(`تم توحيد ${data.count} طلب — تبدأ من ${data.first}`, `Renumbered ${data.count} orders — starting from ${data.first}`));
      loadBatches();
    } catch {
      toast.error(L("تعذّر التوحيد", "Couldn't renumber"));
    } finally {
      setRenumBusy("");
    }
  };

  const fmtCur = (n: number) => `${n.toFixed(3)}`;

  // Passcode gate: while a passcode is set, nothing shows until it's entered.
  if (passSet === null) return <div className="text-center py-20 text-gray-400">...</div>;
  if (passSet && !unlocked) {
    return (
      <div className="max-w-sm mx-auto mt-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
        <Lock className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        {!showReset ? (
          <>
            <h1 className="text-lg font-bold mb-1">{L("الاستيراد محمي بكلمة سر", "Import is passcode-protected")}</h1>
            <p className="text-sm text-gray-500 mb-4">{L("أدخل كلمة السر الخاصة للوصول إلى الاستيراد.", "Enter the private passcode to access import.")}</p>
            <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") unlock(); }} autoFocus
              className="field text-center tracking-widest mb-3" placeholder="••••••" />
            <button onClick={unlock} disabled={passBusy || !passInput}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50">
              {passBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} {L("فتح", "Unlock")}
            </button>
            {hasRecovery && (
              <button onClick={() => setShowReset(true)} className="mt-4 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                {L("نسيت كلمة السر؟ استخدم مفتاح الاسترجاع", "Forgot the passcode? Use the recovery key")}
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold mb-1">{L("استرجاع كلمة السر", "Recover passcode")}</h1>
            <p className="text-sm text-gray-500 mb-4">{L("أدخل مفتاح الاسترجاع الخاص بك وكلمة سر جديدة.", "Enter your recovery key and a new passcode.")}</p>
            <input type="password" value={resetRecovery} onChange={(e) => setResetRecovery(e.target.value)}
              className="field mb-2" placeholder={L("مفتاح الاسترجاع", "Recovery key")} />
            <input type="password" value={resetNewPass} onChange={(e) => setResetNewPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") resetPasscode(); }}
              className="field mb-3" placeholder={L("كلمة السر الجديدة (4 أحرف على الأقل)", "New passcode (at least 4 characters)")} />
            <button onClick={resetPasscode} disabled={passBusy || !resetRecovery || !resetNewPass}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50">
              {passBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} {L("تعيين كلمة سر جديدة", "Set a new passcode")}
            </button>
            <button onClick={() => { setShowReset(false); setResetRecovery(""); setResetNewPass(""); }}
              className="mt-4 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              {L("رجوع", "Back")}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="w-6 h-6" /> {L("استيراد من إكسل", "Import from Excel")}</h1>
          <p className="text-sm text-gray-500 mt-1">{L("استورد جدول التوصيل القديم إلى إدارة الأعمال — مع معاينة قبل الحفظ وإمكانية التراجع.", "Import your old delivery schedule into the work board — with a preview before saving and an undo option.")}</p>
        </div>
        <button onClick={() => setShowSetPass(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          <Lock className="w-3.5 h-3.5" /> {passSet ? L("تغيير كلمة السر", "Change passcode") : L("حماية بكلمة سر", "Protect with passcode")}
        </button>
      </div>

      {!passSet && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 dark:text-amber-200">
            {L("الاستيراد غير محمي حالياً. اضغط ", "Import is currently unprotected. Click ")}<b>{L("«حماية بكلمة سر»", "“Protect with passcode”")}</b>{L(" لتعيين كلمة سر خاصة فيك — بعدها لن يقدر أحد (حتى المدراء) على فتح الاستيراد أو حذف الدفعات بدونها.", " to set your own private passcode — after that, no one (not even managers) can open import or delete batches without it.")}
          </p>
        </div>
      )}

      {/* Set / change passcode modal */}
      {showSetPass && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSetPass(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3 flex items-center gap-2"><Lock className="w-4 h-4" /> {passSet ? L("تغيير كلمة سر الاستيراد", "Change import passcode") : L("تعيين كلمة سر الاستيراد", "Set import passcode")}</h3>
            {passSet && (
              <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)}
                className="field mb-2" placeholder={L("كلمة السر الحالية", "Current passcode")} />
            )}
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
              className="field mb-3" placeholder={L("كلمة السر الجديدة (4 أحرف على الأقل)", "New passcode (at least 4 characters)")} />
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mb-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                {L("مفتاح الاسترجاع", "Recovery key")} {hasRecovery ? <span className="text-emerald-600">{L("(مُعيَّن — اتركه فارغاً للإبقاء عليه)", "(set — leave blank to keep it)")}</span> : <span className="text-gray-400">{L("(يُنصح به بشدة)", "(strongly recommended)")}</span>}
              </label>
              <input type="password" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)}
                className="field" placeholder={L("مفتاح استرجاع خاص (8 أحرف على الأقل)", "Private recovery key (at least 8 characters)")} />
              <p className="text-[11px] text-gray-400 mt-1.5">{L("سر ثانٍ تحفظه في مكان آمن — لو نسيت كلمة السر تعيد تعيينها به دون الحاجة للقديمة.", "A second secret you keep somewhere safe — if you forget the passcode you can reset it with this, without needing the old one.")}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={savePasscode} disabled={passBusy}
                className="flex-1 h-10 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50">{L("حفظ", "Save")}</button>
              <button onClick={() => setShowSetPass(false)} className="px-4 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300">{L("إلغاء", "Cancel")}</button>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">{L("تنبيه: احفظ كلمة السر ومفتاح الاسترجاع في مكان آمن.", "Note: keep the passcode and recovery key somewhere safe.")}</p>
          </div>
        </div>
      )}

      {/* Upload */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
        {/* One-click preset for the BRS delivery-schedule workbook. */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
          <div className="text-[13px] text-teal-800 dark:text-teal-200 font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" />
            {L("ملف دفتر BRS؟ اضغط للضبط التلقائي — سنة 2026 · قابلة للتعديل (لإضافة الأصناف لاحقاً) · ترقيم تلقائي للطلبات بلا رقم · تاريخ تقديري للطلبات بلا تاريخ تسليم · تجاهل صفوف العناوين/البنر/المجاميع", "BRS workbook? Click for auto-setup — year 2026 · editable (to add items later) · auto-numbering for orders without a number · estimated date for orders with no delivery date · skip header/banner/total rows")}
          </div>
          <button onClick={applyBrsPreset}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 shrink-0">
            <Zap className="w-4 h-4" /> {L("ضبط تلقائي (BRS 2026)", "Auto-setup (BRS 2026)")}
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold">
            <Upload className="w-4 h-4" /> {L("اختر ملف إكسل (.xlsx)", "Choose an Excel file (.xlsx)")}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] || null)} />
          {file && <span className="text-sm text-gray-500 font-mono-en">{file.name}</span>}
          {sheets.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-500">{L("الصفحة (التبويب):", "Sheet (tab):")}</label>
              <select value={sheetName} onChange={(e) => changeSheet(e.target.value)} className="field h-11 w-48 text-sm">
                {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1" />
          <label className="text-sm font-semibold text-gray-500">{L("سنوات الطلبات:", "Order years:")}</label>
          <input type="text" value={yearsInput} onChange={(e) => setYearsInput(e.target.value)}
            onBlur={reprocess} className="field w-40 h-11 font-mono-en" placeholder={L("الكل (اتركها فارغة)", "All (leave blank)")} />
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={includeUndated}
              onChange={(e) => { setIncludeUndated(e.target.checked); if (file) runPreview(file, mapping, parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, e.target.checked, undatedStatus); }}
              className="w-4 h-4 accent-gray-900" />
            {L("ضمّن الصفوف بدون تاريخ", "Include rows without a date")}
          </label>
          {includeUndated && (
            <div className="flex items-center gap-2" title={L("تُطبَّق فقط على الطلبات التي لا تحمل أي حالة في الملف؛ الطلبات التي لها حالة تحتفظ بحالتها", "Applies only to orders with no status in the file; orders that have a status keep it")}>
              <label className="text-sm font-semibold text-gray-500">{L("حالة الطلب بدون حالة:", "Status for status-less orders:")}</label>
              <select value={undatedStatus}
                onChange={(e) => { setUndatedStatus(e.target.value); if (file) runPreview(file, mapping, parseYears(yearsInput), statusMap, defaultWorkStatus, headerRow, includeUndated, e.target.value); }}
                className="field h-11 w-40 text-sm">
                {WORK_STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{WS_KEYS[o.key] ? t(WS_KEYS[o.key]) : o.key}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-500 cursor-pointer w-full sm:w-auto" title={L("تُستورد كمسودة قابلة للتعديل، والإجمالي يبقى مرجعاً لإضافة الأصناف يدوياً", "Imported as an editable draft, keeping the total as a reference for adding items manually")}>
            <input type="checkbox" checked={editableDraft} onChange={(e) => setEditableDraft(e.target.checked)}
              className="w-4 h-4 accent-gray-900" />
            {L("قابلة للتعديل + حفظ الإجمالي كمرجع (لإضافة الأصناف)", "Editable + keep total as reference (to add items)")}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-500 cursor-pointer w-full sm:w-auto" title={L("الطلبات التي لا تحمل رقماً في الملف تأخذ رقماً تلقائياً (IMP-0001…) بدل تخطّيها", "Orders with no number in the file get an automatic number (IMP-0001…) instead of being skipped")}>
            <input type="checkbox" checked={autoNumber}
              onChange={(e) => { setAutoNumber(e.target.checked); autoNumberRef.current = e.target.checked; reprocess(); }}
              className="w-4 h-4 accent-gray-900" />
            {L("ولّد رقماً تلقائياً للطلبات بدون رقم", "Auto-generate a number for orders without one")}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 cursor-pointer w-full sm:w-auto" title={L("تستورد كل صف حتى الناقص — يُوضع «بدون اسم» / رقم مؤقت مكان الناقص لتصحيحه لاحقاً", "Import every row even if incomplete — a “no name” / temporary number placeholder fills the gap to fix later")}>
            <input type="checkbox" checked={importIncomplete}
              onChange={(e) => { setImportIncomplete(e.target.checked); importIncompleteRef.current = e.target.checked; reprocess(); }}
              className="w-4 h-4 accent-red-600" />
            {L("استورد كل الصفوف حتى الناقصة (تُصحَّح لاحقاً)", "Import all rows even incomplete ones (fix later)")}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer w-full sm:w-auto" title={L("الصفوف بلا تاريخ تسليم تأخذ تاريخاً تقديرياً من الصفوف المجاورة (الأعلى/الأسفل) لترتيبها في مكانها الصحيح — يظهر بشارة «تقديري» ويُكتب التاريخ النهائي يدوياً", "Rows without a delivery date get an estimated date from neighbouring rows (above/below) to sort into place — shown with an “Estimated” badge; enter the final date manually")}>
            <input type="checkbox" checked={estimateDates}
              onChange={(e) => { setEstimateDates(e.target.checked); estimateDatesRef.current = e.target.checked; reprocess(); }}
              className="w-4 h-4 accent-indigo-600" />
            {L("رتّب الصفوف بلا تاريخ حسب جيرانها (تاريخ تقديري)", "Sort dateless rows by their neighbours (estimated date)")}
          </label>
        </div>
      </div>

      {/* Previous import batches / undo — kept near the top so it's easy to
          find (delete an old batch before re-importing). */}
      {batches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
          <h2 className="font-bold mb-1">{L("دفعات الاستيراد السابقة", "Previous import batches")}</h2>
          <p className="text-xs text-gray-400 mb-3">{L("احذف الدفعة القديمة قبل إعادة الاستيراد حتى لا تتكرر الأرقام.", "Delete the old batch before re-importing so numbers don't duplicate.")}</p>
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.batch} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-bold font-mono-en">{b.batch}</p>
                  <p className="text-xs text-gray-400"><span className="font-mono-en">{b.count}</span> {L("طلب", "orders")} · {new Date(b.at).toLocaleString("en-GB")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => renumberBatch(b.batch)} disabled={renumBusy === b.batch}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">
                    {renumBusy === b.batch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} {L("توحيد الترقيم (HX)", "Renumber (HX)")}
                  </button>
                  <button onClick={() => undo(b.batch)}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20">
                    <RotateCcw className="w-3.5 h-3.5" /> {L("تراجع (حذف الدفعة)", "Undo (delete batch)")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Name-conflict report: after importing, re-check the same file to find
          orders whose name differs from the linked customer (phone collision). */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold mb-1">{L("فحص تعارض الأسماء (بعد الاستيراد)", "Name-conflict check (after import)")}</h2>
            <p className="text-xs text-gray-400">{L("اختر نفس ملف الإكسل الذي استوردته، ثم افحص الطلبات التي يختلف اسمها في الموقع عن اسم صفّها في الملف (بسبب تطابق رقم الهاتف مع عميل موجود).", "Choose the same Excel file you imported, then scan for orders whose name on the site differs from their row's name in the file (due to a phone match with an existing customer).")}</p>
          </div>
          <button onClick={runConflicts} disabled={conflictBusy || !file}
            className="shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">
            {conflictBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} {L("افحص التعارض", "Scan for conflicts")}
          </button>
        </div>
        {!file && <p className="text-xs text-amber-600 mt-2">{L("↑ اختر ملف الإكسل من قسم الرفع أعلاه أولاً.", "↑ Choose the Excel file from the upload section above first.")}</p>}
        {conflicts && (
          <div className="mt-4">
            {conflicts.conflictsCount === 0 ? (
              <p className="text-sm font-semibold text-emerald-600">{L(`✓ لا يوجد تعارض — فُحص`, `✓ No conflicts —`)} <span className="font-mono-en">{conflicts.checked}</span> {L("صف، طوبق", "rows checked,")} <span className="font-mono-en">{conflicts.matched}</span> {L("طلب.", "orders matched.")}</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-red-600 mb-3">
                  <span className="font-mono-en">{conflicts.conflictsCount}</span> {L("طلب اسمه في الموقع يختلف عن الملف. افتح كل طلب وصحّح الاسم (وإن كان العميل مشتركاً مع طلبات أخرى، تواصل معي لإضافة «نقل لعميل جديد»).", "orders have a different name on the site than in the file. Open each order and fix the name (if the customer is shared with other orders, contact me to add “reassign to a new customer”).")}
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-500 text-xs">
                      <tr>
                        <th className="p-2 text-right">{L("رقم الطلب", "Order #")}</th>
                        <th className="p-2 text-right">{L("الاسم في الموقع (خطأ)", "Name on site (wrong)")}</th>
                        <th className="p-2 text-right">{L("الاسم في الملف (الصحيح)", "Name in file (correct)")}</th>
                        <th className="p-2 text-right">{L("الهاتف", "Phone")}</th>
                        <th className="p-2 text-right">{L("التاريخ", "Date")}</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.conflicts.map((c) => (
                        <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-mono-en font-bold">{c.quoteNumber}</td>
                          <td className="p-2 text-red-600 dark:text-red-400 line-through decoration-red-400/60">{c.systemName}</td>
                          <td className="p-2 font-bold text-emerald-700 dark:text-emerald-400">{c.sheetName}</td>
                          <td className="p-2 font-mono-en text-gray-500">{c.phone}</td>
                          <td className="p-2 font-mono-en text-gray-500 whitespace-nowrap">{c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString("en-GB") : "—"}</td>
                          <td className="p-2">
                            <a href={`/quotations/${c.id}/edit`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                              {L("فتح للتصحيح", "Open to fix")}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-5"><Loader2 className="w-4 h-4 animate-spin" /> {L("جارٍ التحليل...", "Analyzing…")}</div>
      )}

      {preview && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            {[
              { label: L(`طلبات ${parseYears(yearsInput).length ? parseYears(yearsInput).join("، ") : "الكل"}`, `${parseYears(yearsInput).length ? parseYears(yearsInput).join(", ") : "all"} orders`), value: preview.yearRows, tone: "text-gray-900 dark:text-white" },
              { label: L("جديدة (ستُضاف)", "New (will be added)"), value: preview.validCount, tone: "text-emerald-600" },
              { label: L("موجودة مسبقاً (تُتخطّى)", "Already exist (skipped)"), value: preview.alreadyExists, tone: "text-blue-600" },
              { label: L("بها أخطاء", "With errors"), value: Math.max(0, preview.errorCount - preview.alreadyExists), tone: "text-red-600" },
              { label: L("إجمالي صفوف الملف", "Total file rows"), value: preview.totalRows, tone: "text-gray-400" },
            ].map((k, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                <p className="text-[11px] text-gray-400 font-semibold mb-1">{k.label}</p>
                <p className={`text-2xl font-black font-mono-en ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {preview.alreadyExists > 0 && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-5 text-sm">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-blue-800 dark:text-blue-200">
                <span className="font-bold font-mono-en">{preview.alreadyExists}</span> {L("طلب موجود مسبقاً في النظام — ", "orders already exist in the system — ")}<b>{L("سيُتخطّى تلقائياً", "they'll be skipped automatically")}</b>{L(" ولن يتكرّر. الكوتيشنات الموجودة وتواريخها ", " and won't duplicate. Existing quotes and their dates ")}<b>{L("لن تتأثّر", "won't be affected")}</b>{L(". سيُضاف فقط ", ". Only ")}<span className="font-bold font-mono-en">{preview.validCount}</span> {L("طلب جديد.", "new orders will be added.")}
              </p>
            </div>
          )}

          {preview.alreadyInTrash > 0 && (
            <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-5 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-rose-800 dark:text-rose-200">
                <span className="font-bold font-mono-en">{preview.alreadyInTrash}</span> {L("طلب موجود في ", "orders are in the ")}<b>{L("سلة المهملات", "trash")}</b>{L(" (محذوف سابقاً) — ", " (previously deleted) — ")}<b>{L("لن يُعاد إضافته", "they won't be re-added")}</b>{L(". لاستعادته استخدم صفحة المهملات.", ". To restore them, use the Trash page.")}
              </p>
            </div>
          )}

          {preview.noiseRows > 0 && (
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-5 text-sm">
              <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-bold font-mono-en">{preview.noiseRows}</span> {L("صف غير فعلي (عناوين مكرّرة / بنر / مجاميع / صفوف فارغة أو بلا بيانات) تم ", "non-data rows (repeated headers / banners / totals / empty or dataless rows) were ")}<b>{L("تجاهله تلقائياً", "skipped automatically")}</b>{L(" — ليست طلبات حقيقية.", " — they aren't real orders.")}
              </p>
            </div>
          )}

          {preview.fileDuplicates.length > 0 && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-5 text-sm">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-blue-800 dark:text-blue-200">
                <span className="font-bold font-mono-en">{preview.fileDuplicates.length}</span> {L("رقم طلب مكرّر داخل الملف — ", "order numbers are duplicated within the file — ")}<b>{L("كل الصفوف تُحفظ", "all rows are saved")}</b>{L(" (المكرر ياخذ لاحقة مثل «-2»، والرقم الأصلي يُسجَّل في الملاحظات).", " (the duplicate gets a suffix like “-2”, and the original number is recorded in the remarks).")}
              </p>
            </div>
          )}

          {estimateDates && preview.estimatedDateRows > 0 && (
            <div className="flex items-start gap-2 rounded-xl p-4 mb-5 text-sm border bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
              <p className="text-indigo-800 dark:text-indigo-200">
                <span className="font-bold font-mono-en">{preview.estimatedDateRows}</span> {L("صف بلا تاريخ أخذ ", "dateless rows took an ")}<b>{L("تاريخاً تقديرياً", "estimated date")}</b>{L(" من الصفوف المجاورة ليُرتَّب في مكانه الصحيح. يظهر مع بشارة «تقديري» — ", " from neighbouring rows to sort into place. Shown with an “Estimated” badge — ")}<b>{L("أكِّد التاريخ النهائي يدوياً", "confirm the final date manually")}</b>{L(" من صفحة العرض.", " from the quote page.")}
              </p>
            </div>
          )}

          {preview.noDateRows > 0 && (
            <div className={`flex items-start gap-2 rounded-xl p-4 mb-5 text-sm border ${includeUndated ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${includeUndated ? "text-emerald-600" : "text-amber-600"}`} />
              <p className={includeUndated ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}>
                <span className="font-bold font-mono-en">{preview.noDateRows}</span> {L("صف بدون تاريخ تسليم ولا حجز مقروء.", "rows with no readable delivery or booking date.")}
                {includeUndated
                  ? L(" ✓ مُضمَّنة الآن (تدخل إدارة الأعمال بدون تاريخ).", " ✓ Included now (they enter the work board without a date).")
                  : L(" لن تُحسب ضمن أي سنة — فعّل «ضمّن الصفوف بدون تاريخ» أعلاه لإدخالها.", " They won't count toward any year — enable “Include rows without a date” above to bring them in.")}
              </p>
            </div>
          )}

          {/* Column mapping */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h2 className="font-bold">{L("ربط الأعمدة", "Column mapping")}</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500">{L("صف العناوين:", "Header row:")}</label>
                <input type="number" min={1} value={headerRow}
                  onChange={(e) => setHeaderRow(Math.max(1, +e.target.value || 1))} onBlur={reprocess}
                  className="field w-20 h-9 font-mono-en text-xs" />
              </div>
            </div>
            {headers.length > 0 && (
              <p className="text-xs text-gray-400 mb-3">{L("الأعمدة المكتشفة:", "Detected columns:")} <span className="font-mono-en">{headers.join(" · ")}</span></p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{L(f.ar, f.en)}{(f.arHint || f.enHint) && <span className="text-gray-400 font-normal"> — {L(f.arHint || "", f.enHint || "")}</span>}</label>
                  <select value={mapping[f.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="field h-9 text-xs">
                    <option value="">{L("— بدون —", "— none —")}</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={reprocess} className="mt-4 inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700">
              <RotateCcw className="w-4 h-4" /> {L("إعادة المعاينة", "Re-preview")}
            </button>
          </div>

          {/* Status mapping */}
          {preview.distinctStatuses.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
              <h2 className="font-bold mb-3">{L("تحويل الحالة → حالة العمل في النظام", "Map status → system work status")}</h2>
              <div className="space-y-2">
                {preview.distinctStatuses.map((s) => (
                  <div key={s.raw} className="flex items-center gap-3">
                    <span className="text-sm font-semibold min-w-[140px] truncate">{s.raw} <span className="text-gray-400 font-mono-en">({s.count})</span></span>
                    <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <select value={statusMap[s.raw] || defaultWorkStatus} onChange={(e) => setStatusMap((m) => ({ ...m, [s.raw]: e.target.value }))}
                      className="field h-9 text-xs flex-1 max-w-xs">
                      {WORK_STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{WS_KEYS[o.key] ? t(WS_KEYS[o.key]) : o.key}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">{L("الطلبات غير المسلَّمة تدخل إدارة الأعمال، وتنتقل لقائمة التوصيل/التصوير حسب حالتها.", "Undelivered orders enter the work board and move to the delivery/photography list according to their status.")}</p>
            </div>
          )}

          {/* Sample preview */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-5">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700"><h2 className="font-bold">{L(`معاينة (أول ${preview.sample.length} صف)`, `Preview (first ${preview.sample.length} rows)`)}</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 text-gray-400">
                    <th className="text-right p-2 px-3 font-semibold">{L("رقم الطلب", "Order #")}</th>
                    <th className="text-right p-2 font-semibold">{L("العميل", "Customer")}</th>
                    <th className="text-right p-2 font-semibold">{L("الهاتف", "Phone")}</th>
                    <th className="text-right p-2 font-semibold">{L("المنطقة", "Area")}</th>
                    <th className="text-right p-2 font-semibold">{L("الإجمالي", "Total")}</th>
                    <th className="text-right p-2 font-semibold">{L("التسليم", "Delivery")}</th>
                    <th className="text-right p-2 font-semibold">{L("الحالة", "Status")}</th>
                    <th className="text-right p-2 font-semibold">{L("ملاحظة", "Note")}</th>
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
                        <td className="p-2 font-mono-en whitespace-nowrap">{r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString("en-GB") : "—"}{r.deliveryDateEstimated && <span className="mr-1 align-middle rounded px-1 py-0.5 text-[10px] font-sans font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{L("تقديري", "Estimated")}</span>}</td>
                        <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ws?.badgeColor || "bg-gray-100 text-gray-600"}`}>{WS_KEYS[r.systemWorkStatus] ? t(WS_KEYS[r.systemWorkStatus]) : (ws?.label || r.systemWorkStatus)}</span></td>
                        <td className="p-2">
                          {bad && <span className="inline-flex items-center gap-1 text-red-600 text-[11px] font-bold"><AlertTriangle className="w-3 h-3" /> {r.errors.map((e) => errLabel(e)).join(L("، ", ", "))}</span>}
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
              {L(`استيراد ${preview.validCount} طلب إلى إدارة الأعمال`, `Import ${preview.validCount} orders into the work board`)}
            </button>
            <span className="text-xs text-gray-400">{L("الصفوف التي بها أخطاء تُتخطّى تلقائياً.", "Rows with errors are skipped automatically.")}</span>
          </div>
        </>
      )}

      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 mb-5">
          <p className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"><Check className="w-5 h-5" /> {L(`تم استيراد ${result.created} طلب.`, `Imported ${result.created} orders.`)}</p>
          {result.skippedCount > 0 && (
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-semibold mb-1">{L(`تم تخطّي ${result.skippedCount} صف — التفصيل:`, `Skipped ${result.skippedCount} rows — breakdown:`)}</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(result.reasonCounts || {}).map(([r, c]) => (
                  <span key={r} className="px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold">
                    {errLabel(r)}: <span className="font-mono-en">{c}</span>
                  </span>
                ))}
              </div>
              {result.skipped && result.skipped.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 font-semibold">{L("عرض الصفوف المتخطّاة", "Show skipped rows")}</summary>
                  <div className="max-h-56 overflow-y-auto mt-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full">
                      <thead><tr className="text-gray-400 bg-gray-50 dark:bg-gray-900/40">
                        <th className="text-right p-2">{L("الصف", "Row")}</th><th className="text-right p-2">{L("رقم الطلب", "Order #")}</th><th className="text-right p-2">{L("السبب", "Reason")}</th>
                      </tr></thead>
                      <tbody>
                        {result.skipped.map((s, i) => (
                          <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                            <td className="p-2 font-mono-en">{s.row}</td>
                            <td className="p-2 font-mono-en">{s.order}</td>
                            <td className="p-2">{errLabel(s.reason)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
