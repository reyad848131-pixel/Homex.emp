"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { GOVERNORATES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { normalizePhone } from "@/lib/text";
import { useToast } from "@/components/toast";
import { CategoryBuilder, NumField, type Category } from "@/components/quote-builders";
import {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus, Refrigerator, Coffee, Columns2,
  Trash2, ShoppingCart, ArrowLeft, ArrowRight, Save, Check, Eye, Pencil, X, ShieldAlert,
} from "lucide-react";
import Link from "next/link";

const ICONS: Record<string, any> = {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus, Refrigerator, Coffee, Columns2,
};

interface LineItem {
  id: string; categoryId: string; categoryNameAr: string; categoryNameEn: string;
  description: string; details: Record<string, any>; quantity: number;
  unitPrice: number; extras: number; lineTotal: number;
}

interface CustomerData {
  name: string; phone: string; phoneCode: string;
  governorate: string; wilayat: string; address: string;
}

export default function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t, locale, dateLocale } = useI18n();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [advancePct, setAdvancePct] = useState(15);
  const [vatRate, setVatRate] = useState(0.05);
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryDateEstimated, setDeliveryDateEstimated] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");

  const [customer, setCustomer] = useState<CustomerData>({
    name: "", phone: "", phoneCode: "+968", governorate: "", wilayat: "", address: "",
  });

  const [builderDesc, setBuilderDesc] = useState("");
  const [builderQty, setBuilderQty] = useState(1);
  const [builderPrice, setBuilderPrice] = useState(0);
  const [builderExtras, setBuilderExtras] = useState(0);
  const [builderDetails, setBuilderDetails] = useState<Record<string, any>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [builderInitial, setBuilderInitial] = useState<Record<string, any> | undefined>(undefined);
  const [locked, setLocked] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [isManager, setIsManager] = useState(true);

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (m) setIsManager(m.role === "admin" || m.role === "ceo" || m.role === "manager");
    }).catch(() => {});
  }, []);
  // Reference total from an Excel import — shown so the user can add items until
  // the quote matches the confirmed paper total.
  const [importedTotal, setImportedTotal] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/quotations/${id}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([q, cats]) => {
      setCategories(cats);
      setCustomerId(q.customer?.id || "");
      setQuoteNumber(q.quoteNumber || "");
      setEmployeeName(q.employee?.name || "");
      setCreatedAt(q.createdAt || "");
      setCustomer({
        name: q.customer?.name || "",
        phone: q.customer?.phone || "",
        phoneCode: q.customer?.phoneCode || "+968",
        governorate: q.customer?.governorate || "",
        wilayat: q.customer?.wilayat || "",
        address: q.customer?.address || "",
      });
      setAdvancePct(q.advancePct ?? 15);
      setVatRate(q.vatRate ?? 0.05);
      setNotes(q.notes || "");
      setDeliveryDate(q.deliveryDate ? new Date(q.deliveryDate).toISOString().split("T")[0] : "");
      setDeliveryDateEstimated(!!q.deliveryDateEstimated);
      setDeliveryTime(q.deliveryTime || "");
      setImportedTotal(typeof q.importedTotal === "number" ? q.importedTotal : null);
      // A financially-locked quote can only be edited by a manager (server-
      // enforced) and requires a justification captured below.
      setLocked(!!q.invoice || (q.payments?.length ?? 0) > 0 || q.status === "accepted");
      setItems(
        (q.items || []).map((item: any) => ({
          id: item.id,
          categoryId: item.categoryId,
          categoryNameAr: item.category?.nameAr || "",
          categoryNameEn: item.category?.nameEn || "",
          description: item.description,
          details: item.details ? (typeof item.details === "string" ? JSON.parse(item.details) : item.details) : {},
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extras: item.extras,
          lineTotal: item.lineTotal,
        }))
      );
      setLoading(false);
    });
  }, [id]);

  const catName = (cat: Category) => locale === "en" ? cat.nameEn : cat.nameAr;
  const itemCatName = (item: LineItem) => locale === "en" ? item.categoryNameEn : item.categoryNameAr;

  const wilayats = customer.governorate ? GOVERNORATES[customer.governorate] || [] : [];
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const vat = Math.round(subtotal * vatRate * 1000) / 1000;
  const total = Math.round((subtotal + vat) * 1000) / 1000;
  const advance = Math.round(total * (advancePct / 100) * 1000) / 1000;
  const fmtCur = (n: number) => `${n.toFixed(3)} ${t("omr")}`;

  // Shared form-control classes (defined once in globals.css).
  const fieldBase = "field";
  const fieldRO = "field-ro";

  const resetBuilder = useCallback(() => {
    setBuilderDesc(""); setBuilderQty(1); setBuilderPrice(0); setBuilderExtras(0);
    setBuilderDetails({}); setEditingItemId(null); setBuilderInitial(undefined);
  }, []);

  const handleBuilderUpdate = useCallback((d: string, p: number, e: number, details?: Record<string, any>) => {
    setBuilderDesc(d); setBuilderPrice(p); setBuilderExtras(e);
    if (details) setBuilderDetails(details);
  }, []);

  const addItem = () => {
    if (!selectedCat || !builderDesc || builderPrice <= 0) return;
    const lineTotal = builderQty * builderPrice + builderExtras;
    if (editingItemId) {
      setItems((prev) => prev.map((it) => it.id === editingItemId ? {
        ...it,
        categoryId: selectedCat.id,
        categoryNameAr: selectedCat.nameAr,
        categoryNameEn: selectedCat.nameEn,
        description: builderDesc,
        details: builderDetails,
        quantity: builderQty,
        unitPrice: builderPrice,
        extras: builderExtras,
        lineTotal,
      } : it));
    } else {
      setItems((prev) => [...prev, {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2), categoryId: selectedCat.id,
        categoryNameAr: selectedCat.nameAr, categoryNameEn: selectedCat.nameEn,
        description: builderDesc, details: builderDetails, quantity: builderQty, unitPrice: builderPrice,
        extras: builderExtras, lineTotal,
      }]);
    }
    resetBuilder();
  };

  const removeItem = (itemId: string) => {
    if (editingItemId === itemId) resetBuilder();
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const startEditItem = (item: LineItem) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    if (!cat) return;
    setSelectedCat(cat);
    setBuilderInitial(item.details && Object.keys(item.details).length ? item.details : undefined);
    setBuilderDesc(item.description);
    setBuilderPrice(item.unitPrice);
    setBuilderExtras(item.extras);
    setBuilderDetails(item.details || {});
    setBuilderQty(item.quantity);
    setEditingItemId(item.id);
    setStep(3);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canProceed = (s: number) => {
    if (s === 1) return customer.name && customer.phone && /^\d{8}$/.test(customer.phone) && customer.governorate && customer.wilayat;
    if (s === 2) return selectedCat !== null;
    if (s === 3) return items.length > 0;
    return true;
  };

  const handleSave = async () => {
    if (locked && !editReason.trim()) {
      setSaveError(t("editReasonRequired"));
      setStep(4);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          customer,
          items: items.map(({ id: _, categoryNameAr, categoryNameEn, ...rest }) => rest),
          notes,
          advancePct,
          vatRate,
          deliveryDate: deliveryDate || null,
          deliveryTime: deliveryTime || null,
          ...(locked ? { editReason: editReason.trim() } : {}),
        }),
      });
      if (res.ok) {
        toast.success(t("savedSuccess"));
        router.push(`/quotations/${id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || t("saveEditsFailed"));
        toast.error(err.error || t("saveEditsFailed"));
      }
    } catch {
      setSaveError(t("serverConnectionError"));
      toast.error(t("serverConnectionError"));
    } finally { setSaving(false); }
  };

  // Save just the customer info (+ delivery date) without touching items — for
  // quick fixes like a mistyped name on a freshly imported order, where there
  // are no items yet so the full save is blocked.
  const saveInfoOnly = async () => {
    if (!canProceed(1)) { toast.error(t("completeCustomerFirst")); return; }
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Customer only — no items, no delivery date (so an imported estimated
        // date isn't silently marked confirmed just by fixing a name).
        body: JSON.stringify({ customerId, customer }),
      });
      if (res.ok) {
        toast.success(t("customerInfoSaved"));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("saveEditsFailed"));
      }
    } catch {
      toast.error(t("serverConnectionError"));
    } finally { setSaving(false); }
  };

  const renderCategoryBuilder = () => {
    if (!selectedCat) return null;
    return (
      <CategoryBuilder
        key={`${selectedCat.id}:${editingItemId ?? "new"}`}
        cat={selectedCat}
        governorate={customer.governorate}
        wilayat={customer.wilayat}
        onUpdate={handleBuilderUpdate}
        initial={builderInitial}
      />
    );
  };

  if (loading) return <div className="text-center py-20 text-gray-400">{t("loading")}</div>;

  const steps = [
    { num: 1, label: t("stepCustomerInfo") },
    { num: 2, label: t("stepChooseCategories") },
    { num: 3, label: t("stepItems") },
    { num: 4, label: t("stepReview") },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/quotations/${id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("editQuotation")} <span className="font-mono-en text-gray-400">{quoteNumber}</span></h1>
      </div>

      {importedTotal != null && (() => {
        const diff = Math.round((total - importedTotal) * 1000) / 1000;
        const matched = Math.abs(diff) < 0.001;
        return (
          <div className={cn("max-w-3xl mx-auto mb-5 rounded-lg border p-4",
            matched ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800")}>
            <p className={cn("text-sm font-bold mb-2", matched ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200")}>
              {t("edtImportedHint")}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-mono-en">
              <span className="text-gray-600 dark:text-gray-300">{t("edtImported")}: <b>{fmtCur(importedTotal)}</b></span>
              <span className="text-gray-600 dark:text-gray-300">{t("edtCurrent")}: <b>{fmtCur(total)}</b></span>
              {matched ? (
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{t("edtMatch")}</span>
              ) : (
                <span className="font-bold text-blue-700 dark:text-blue-300">{t("edtDiff")}: {fmtCur(Math.abs(diff))} {diff > 0 ? t("edtOver") : t("edtUnder")}</span>
              )}
            </div>
          </div>
        );
      })()}

      {locked && isManager && (
        <div className="max-w-3xl mx-auto mb-5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">
            <ShieldAlert className="w-4 h-4" /> {t("managerEditWarning")}
          </p>
          <label className="block text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">{t("editReasonLabel")}</label>
          <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2}
            className="field-textarea resize-y" placeholder={t("editReasonPlaceholder")} />
        </div>
      )}

      {locked && !isManager && (
        <div className="max-w-3xl mx-auto mb-5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300">
            <ShieldAlert className="w-4 h-4" /> {t("edtLocked")}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-8 max-w-2xl mx-auto">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                step >= s.num ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-300 text-gray-400"
              )}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={cn("text-xs font-semibold", step >= s.num ? "text-gray-900" : "text-gray-400")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={cn("h-0.5 flex-1 mt-[-18px]", step > s.num ? "bg-gray-900" : "bg-gray-200")} />}
          </div>
        ))}
      </div>

      {/* Step 1: Customer Info */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold mb-5">{t("customerAndQuoteInfo")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("employeeNameLabel")}</label>
              <input type="text" value={employeeName} readOnly className={fieldRO} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("quoteNumberLabel")}</label>
              <input type="text" value={quoteNumber} readOnly className={cn(fieldRO, "font-mono-en")} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("dateLabel")}</label>
              <input type="text" value={createdAt ? new Date(createdAt).toLocaleDateString(dateLocale) : ""} readOnly className={fieldRO} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("deliveryDateLabel")}</label>
              <div className="flex gap-2">
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                  className={cn(fieldBase, "flex-1 min-w-0 font-mono-en", deliveryDateEstimated && "ring-2 ring-indigo-400/60")} />
                <input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)}
                  aria-label={t("deliveryTimeLabel")} title={t("deliveryTimeLabel")}
                  className={cn(fieldBase, "w-28 shrink-0 font-mono-en")} />
              </div>
              {deliveryDateEstimated && (
                <p className="mt-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {t("edtEstHint")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("advancePctLabel")}</label>
              <NumField value={advancePct} onChange={setAdvancePct} min={0} max={100} int
                className={cn(fieldBase, "font-mono-en text-center")} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("remainingPctLabel")}</label>
              <input type="text" value={`${100 - advancePct}%`} readOnly
                className={cn(fieldRO, "font-mono-en text-center")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("advanceAmountLabel")}</label>
              <input type="text" value={total > 0 ? fmtCur(advance) : `0.000 ${t("omr")}`} readOnly
                className={cn(fieldRO, "font-mono-en")} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("remainingAmountLabel")}</label>
              <input type="text" value={total > 0 ? fmtCur(total - advance) : `0.000 ${t("omr")}`} readOnly
                className={cn(fieldRO, "font-mono-en")} />
            </div>
          </div>

          <div className="border-t border-gray-200 my-5"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("customerNameReq")}</label>
              <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className={fieldBase} placeholder={t("customerNamePlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("phoneReq")}</label>
              <div className="flex gap-2">
                <select value={customer.phoneCode} onChange={(e) => setCustomer({ ...customer, phoneCode: e.target.value })}
                  className={cn(fieldBase, "w-28 shrink-0 font-mono-en")}>
                  <option value="+968">+968</option><option value="+971">+971</option><option value="+966">+966</option>
                </select>
                <input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: normalizePhone(e.target.value).slice(0, 8) })}
                  pattern="[0-9]{8}" maxLength={8}
                  className={cn(fieldBase, "flex-1 min-w-0 font-mono-en")} placeholder="9XXXXXXX" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("governorateReq")}</label>
              <select value={customer.governorate} onChange={(e) => setCustomer({ ...customer, governorate: e.target.value, wilayat: "" })}
                className={fieldBase}>
                <option value="">{t("chooseGovernorate")}</option>
                {Object.keys(GOVERNORATES).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("wilayatReq")}</label>
              <select value={customer.wilayat} onChange={(e) => setCustomer({ ...customer, wilayat: e.target.value })}
                className={cn(fieldBase, "disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-gray-900/40")} disabled={!customer.governorate}>
                <option value="">{t("chooseWilayat")}</option>
                {wilayats.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          {/* Quick save for customer info only — handy for fixing a name on an
              imported order without needing to add any items. */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-400">{t("saveCustomerHint")}</p>
            <button
              onClick={saveInfoOnly}
              disabled={saving || !canProceed(1)}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {t("saveCustomerInfo")}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Choose Categories */}
      {step === 2 && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <div className="mb-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{t("stepXofY")} 2 {t("ofSteps")} 4</p>
              <h2 className="text-lg font-bold">{t("chooseCategory")}</h2>
              <p className="text-sm text-gray-500">{t("categoryInstruction")}</p>
            </div>
            {items.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                {categories.map((cat) => {
                  const count = items.filter((i) => i.categoryId === cat.id).length;
                  if (count === 0) return null;
                  return (
                    <span key={cat.id} className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold">
                      {catName(cat)} ✓ ({count})
                    </span>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {categories.map((cat) => {
                const Icon = ICONS[cat.icon] || Plus;
                const count = items.filter((i) => i.categoryId === cat.id).length;
                return (
                  <button key={cat.id} onClick={() => { setSelectedCat(cat); resetBuilder(); }}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 border rounded text-xs font-bold transition-all",
                      selectedCat?.id === cat.id
                        ? "bg-gray-900 border-gray-900 text-white"
                        : count > 0
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                    )}>
                    <Icon className="w-6 h-6" />
                    <span className="text-center leading-tight">{catName(cat)}</span>
                    {count > 0 && (
                      <span className="absolute top-1 left-1 w-5 h-5 bg-emerald-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Items Builder */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
              <div className="mb-4">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{t("stepXofY")} 3 {t("ofSteps")} 4</p>
                <h2 className="text-lg font-bold">{t("addItemsDash")} {selectedCat ? catName(selectedCat) : ""}</h2>
              </div>

              <div className="flex gap-1.5 flex-wrap mb-4">
                {categories.map((cat) => {
                  const count = items.filter((i) => i.categoryId === cat.id).length;
                  const isActive = selectedCat?.id === cat.id;
                  const isDone = count > 0;
                  return (
                    <button key={cat.id} onClick={() => { setSelectedCat(cat); resetBuilder(); }}
                      className={cn(
                        "px-3 py-1.5 border rounded-full text-[11px] font-bold transition-all",
                        isActive
                          ? "bg-gray-900 border-gray-900 text-white"
                          : isDone
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-white border-gray-200 text-gray-400 hover:border-gray-400"
                      )}>
                      {isDone && !isActive ? `${catName(cat)} ✓` : catName(cat)}
                    </button>
                  );
                })}
              </div>

              {selectedCat && (
                <>
                  {editingItemId && (
                    <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm">
                      <span className="flex items-center gap-2 font-semibold"><Pencil className="w-4 h-4" /> {t("editingItemNotice")}</span>
                      <button onClick={resetBuilder} className="flex items-center gap-1 px-3 py-1 rounded border border-blue-300 dark:border-blue-700 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                        <X className="w-3.5 h-3.5" /> {t("cancelEdit")}
                      </button>
                    </div>
                  )}

                  {renderCategoryBuilder()}

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">{selectedCat?.id === "sofa-set" ? t("pricePerMeter") : t("quantity")}</label>
                      <NumField value={builderQty} onChange={setBuilderQty} min={0.1}
                        className="field text-center font-mono-en" />
                    </div>
                    <div className="flex items-end">
                      <div className="bg-gray-100 rounded px-4 py-2.5 text-center w-full">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">{t("lineItemTotal")}</p>
                        <p className="text-lg font-black font-mono-en text-gray-900">
                          {fmtCur(builderQty * builderPrice + builderExtras)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button onClick={addItem} disabled={!builderDesc || builderPrice <= 0}
                    className={cn(
                      "mt-4 w-full text-white font-bold py-3 rounded text-sm transition-colors disabled:opacity-30 flex items-center justify-center gap-2",
                      editingItemId ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-900 hover:bg-gray-800"
                    )}>
                    {editingItemId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingItemId ? t("saveEditBtn") : t("addToQuote")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Items Summary Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">{t("addedItems")}</h2>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="text-center py-8"><ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400 font-semibold">{t("noItemsYet")}</p></div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id}
                      className={cn(
                        "border rounded p-3 transition-colors",
                        editingItemId === item.id
                          ? "border-blue-400 ring-1 ring-blue-300 bg-blue-50/50 dark:bg-blue-900/10"
                          : "border-gray-100 dark:border-gray-700 hover:border-gray-300"
                      )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-semibold">{itemCatName(item)}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{item.description}</p>
                          <p className="text-xs text-gray-500 mt-1 font-mono-en">
                            {item.quantity} x {fmtCur(item.unitPrice)}
                            {item.extras > 0 && ` + ${fmtCur(item.extras)}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
                          <p className="text-sm font-black font-mono-en">{fmtCur(item.lineTotal)}</p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEditItem(item)}
                              className="p-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-400" aria-label={t("edit")}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeItem(item.id)}
                              className="p-1.5 rounded border border-red-200 text-red-500 hover:text-red-700 hover:border-red-400" aria-label={t("deleteAction")}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t("subtotal")}</span><span className="font-bold font-mono-en">{fmtCur(subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t("vat")} ({(vatRate * 100).toFixed(0)}%)</span><span className="font-bold font-mono-en">{fmtCur(vat)}</span></div>
                  <div className="flex justify-between text-base pt-2 border-t border-gray-200"><span className="font-bold">{t("grandTotal")}</span><span className="font-black font-mono-en text-lg">{fmtCur(total)}</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <h2 className="text-base font-bold mb-3">{t("customerData")}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">{t("nameColon")}</span> <span className="font-bold">{customer.name}</span></div>
              <div><span className="text-gray-400">{t("phoneColon")}</span> <span className="font-bold font-mono-en">{customer.phoneCode} {customer.phone}</span></div>
              <div><span className="text-gray-400">{t("governorateColon")}</span> <span className="font-bold">{customer.governorate}</span></div>
              <div><span className="text-gray-400">{t("wilayatColon")}</span> <span className="font-bold">{customer.wilayat}</span></div>
              {deliveryDate && <div><span className="text-gray-400">{t("deliveryDateColon")}</span> <span className="font-bold font-mono-en">{deliveryDate}</span></div>}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <h2 className="text-base font-bold mb-3">{t("itemDetails")} ({items.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">#</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("item")}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("quantity")}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("price")}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("total")}</th>
                </tr></thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2.5 font-mono-en text-gray-400">{i + 1}</td>
                      <td className="py-2.5"><p className="font-bold">{item.description}</p><p className="text-xs text-gray-400">{itemCatName(item)}</p></td>
                      <td className="py-2.5 font-mono-en">{item.quantity}</td>
                      <td className="py-2.5 font-mono-en">{fmtCur(item.unitPrice)}</td>
                      <td className="py-2.5 font-mono-en font-bold">{fmtCur(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("notes")}</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="field-textarea resize-none" rows={2} placeholder={t("notesPlaceholder")} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("advanceRate")}</span>
                  <span className="font-bold font-mono-en">{advancePct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("advanceAmountLabel")}</span>
                  <span className="font-bold font-mono-en text-green-600">{fmtCur(advance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("remainingAmountLabel")}</span>
                  <span className="font-bold font-mono-en">{fmtCur(total - advance)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 text-white rounded p-5 mt-5">
              <div className="flex justify-between items-center mb-3"><span className="text-gray-400 text-sm">{t("subtotal")}</span><span className="font-bold font-mono-en">{fmtCur(subtotal)}</span></div>
              <div className="flex justify-between items-center mb-3"><span className="text-gray-400 text-sm">{t("vat")} ({(vatRate * 100).toFixed(0)}%)</span><span className="font-bold font-mono-en">{fmtCur(vat)}</span></div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700"><span className="font-bold text-lg">{t("finalTotal")}</span><span className="text-2xl font-black font-mono-en">{fmtCur(total)}</span></div>
              <div className="flex justify-between items-center mt-2"><span className="text-gray-400 text-sm">{t("advancePayment")} ({advancePct}%)</span><span className="font-bold font-mono-en text-green-400">{fmtCur(advance)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {saveError && (
        <div className="mt-4 max-w-3xl mx-auto bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm font-semibold">
          {saveError}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 max-w-3xl mx-auto">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
          <ArrowRight className="w-4 h-4" /> {t("previous")}
        </button>
        {step < 4 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed(step)}
            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-30 transition-colors">
            {t("next")} <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving || items.length === 0 || (locked && !isManager)}
            className="flex items-center gap-2 bg-green-700 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-green-800 disabled:opacity-30 transition-colors">
            <Save className="w-4 h-4" /> {saving ? t("savingText") : t("saveChanges")}
          </button>
        )}
      </div>

      {/* Floating Summary */}
      {items.length > 0 && step === 3 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-2xl px-3 sm:px-5 py-3 shadow-2xl flex items-center gap-2 sm:gap-3 z-50 max-w-[calc(100vw-1rem)]">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-bold text-sm whitespace-nowrap">{items.length} {t("itemsWord")}</span>
          </div>
          <span className="w-px h-5 bg-gray-600 shrink-0" />
          <span className="font-black font-mono-en text-emerald-400">{fmtCur(total)}</span>
          <span className="w-px h-5 bg-gray-600" />
          <button onClick={() => setStep(4)} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
            <Eye className="w-3.5 h-3.5" />
            {t("previewBtn")}
          </button>
          <button onClick={handleSave} disabled={saving || (locked && !isManager)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />
            {t("save")}
          </button>
        </div>
      )}
    </div>
  );
}
