"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { GOVERNORATES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { CategoryBuilder, type Category } from "@/components/quote-builders";
import {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus,
  Trash2, ShoppingCart, ArrowLeft, ArrowRight, Save, Check, Eye, Pencil, RotateCcw, X,
} from "lucide-react";

const ICONS: Record<string, any> = {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus,
};

interface LineItem {
  id: string;
  categoryId: string;
  categoryNameAr: string;
  categoryNameEn: string;
  description: string;
  details: Record<string, any>;
  quantity: number;
  unitPrice: number;
  extras: number;
  lineTotal: number;
}

interface CustomerData {
  name: string;
  phone: string;
  phoneCode: string;
  governorate: string;
  wilayat: string;
  address: string;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [advancePct, setAdvancePct] = useState(15);
  const [vatRate, setVatRate] = useState(0.05);
  const [notes, setNotes] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");

  const [customer, setCustomer] = useState<CustomerData>({
    name: "", phone: "", phoneCode: "+968",
    governorate: "", wilayat: "", address: "",
  });

  const [builderDesc, setBuilderDesc] = useState("");
  const [builderQty, setBuilderQty] = useState(1);
  const [builderPrice, setBuilderPrice] = useState(0);
  const [builderExtras, setBuilderExtras] = useState(0);
  const [builderDetails, setBuilderDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch("/api/categories").then((r) => r.ok ? r.json() : []).then(setCategories).catch(() => {});
    fetch("/api/me").then((r) => r.ok ? r.json() : {}).then((u: any) => setEmployeeName(u?.name || "")).catch(() => {});
    fetch("/api/settings").then((r) => r.ok ? r.json() : {}).then((s: any) => {
      // Don't override values already restored from a saved draft.
      if (draftAppliedRef.current) return;
      if (s.vat_rate) setVatRate(parseFloat(s.vat_rate) / 100 || 0.05);
      if (s.advance_pct) setAdvancePct(parseInt(s.advance_pct) || 15);
    }).catch(() => {});
  }, []);

  const catName = (cat: Category) => locale === "en" ? cat.nameEn : cat.nameAr;
  const itemCatName = (item: LineItem) => locale === "en" ? item.categoryNameEn : item.categoryNameAr;

  const wilayats = customer.governorate ? GOVERNORATES[customer.governorate] || [] : [];

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const vat = subtotal * vatRate;
  const total = subtotal + vat;
  const advance = total * (advancePct / 100);

  const fmtCur = (n: number) => `${n.toFixed(3)} ${t("omr")}`;

  const resetBuilder = useCallback(() => {
    setBuilderDesc("");
    setBuilderQty(1);
    setBuilderPrice(0);
    setBuilderExtras(0);
    setBuilderDetails({});
  }, []);

  const handleBuilderUpdate = useCallback((d: string, p: number, e: number) => {
    setBuilderDesc(d);
    setBuilderPrice(p);
    setBuilderExtras(e);
  }, []);

  // ---- Draft auto-save: survives navigating away or refreshing the page ----
  const DRAFT_KEY = "homex_new_quote_draft";
  const draftAppliedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && (d.items?.length || d.customer?.name)) {
          if (d.customer) setCustomer(d.customer);
          if (Array.isArray(d.items)) setItems(d.items);
          if (typeof d.notes === "string") setNotes(d.notes);
          if (typeof d.advancePct === "number") setAdvancePct(d.advancePct);
          if (typeof d.vatRate === "number") setVatRate(d.vatRate);
          if (d.quoteDate) setQuoteDate(d.quoteDate);
          if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
          draftAppliedRef.current = true;
          setDraftRestored(true);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ customer, items, notes, advancePct, vatRate, quoteDate, deliveryDate }));
    } catch {}
  }, [hydrated, customer, items, notes, advancePct, vatRate, quoteDate, deliveryDate]);

  // Warn before closing/refreshing the tab with unsaved items.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (items.length > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [items.length]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setItems([]);
    setNotes("");
    setCustomer({ name: "", phone: "", phoneCode: "+968", governorate: "", wilayat: "", address: "" });
    setDraftRestored(false);
    resetBuilder();
  };

  // Inline edit of an already-added item; recomputes its line total.
  const [editingId, setEditingId] = useState<string | null>(null);
  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      next.lineTotal = Math.max(1, next.quantity) * Math.max(0, next.unitPrice) + Math.max(0, next.extras);
      return next;
    }));
  };

  const addItem = () => {
    if (!selectedCat || !builderDesc || builderPrice <= 0) return;
    const lineTotal = builderQty * builderPrice + builderExtras;
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        categoryId: selectedCat.id,
        categoryNameAr: selectedCat.nameAr,
        categoryNameEn: selectedCat.nameEn,
        description: builderDesc,
        details: builderDetails,
        quantity: builderQty,
        unitPrice: builderPrice,
        extras: builderExtras,
        lineTotal,
      },
    ]);
    resetBuilder();
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const canProceed = (s: number) => {
    if (s === 1) return customer.name && customer.phone && /^\d{8}$/.test(customer.phone) && customer.governorate && customer.wilayat;
    if (s === 2) return selectedCat !== null;
    if (s === 3) return items.length > 0;
    return true;
  };

  const [saveError, setSaveError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: items.map(({ id, categoryNameAr, categoryNameEn, ...rest }) => rest),
          notes,
          advancePct,
          vatRate,
          quoteDate,
          deliveryDate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        toast.success(t("savedSuccess"));
        router.push(`/quotations/${data.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || t("saveFailed"));
        toast.error(err.error || t("saveFailed"));
      }
    } catch {
      setSaveError(t("serverConnectionError"));
      toast.error(t("serverConnectionError"));
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryBuilder = () => {
    if (!selectedCat) return null;
    return (
      <CategoryBuilder
        cat={selectedCat}
        governorate={customer.governorate}
        wilayat={customer.wilayat}
        onUpdate={handleBuilderUpdate}
      />
    );
  };

  const steps = [
    { num: 1, label: t("stepCustomerInfo") },
    { num: 2, label: t("stepChooseCategories") },
    { num: 3, label: t("stepItems") },
    { num: 4, label: t("stepReview") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("createNewQuotation")}</h1>

      {draftRestored && (
        <div className="flex items-center justify-between gap-3 mb-5 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <span className="flex items-center gap-2 font-semibold"><RotateCcw className="w-4 h-4" /> {t("draftRestoredMsg")}</span>
          <button onClick={clearDraft} className="flex items-center gap-1 px-3 py-1 rounded border border-amber-300 dark:border-amber-700 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
            <X className="w-3.5 h-3.5" /> {t("startNewQuote")}
          </button>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 max-w-2xl mx-auto">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                step > s.num ? "bg-gray-900 border-gray-900 text-white" :
                step === s.num ? "bg-gray-900 border-gray-900 text-white" :
                "bg-white border-gray-300 text-gray-400"
              )}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={cn("text-xs font-semibold", step >= s.num ? "text-gray-900" : "text-gray-400")}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-0.5 flex-1 mt-[-18px]", step > s.num ? "bg-gray-900" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Customer Info + Quote Info */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold mb-5">{t("customerAndQuoteInfo")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("employeeNameLabel")}</label>
              <input type="text" value={employeeName} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("quoteNumberLabel")}</label>
              <input type="text" value={t("autoOnSave")} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-400 font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("dateLabel")}</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("deliveryDateLabel")}</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("advancePctLabel")}</label>
              <input type="number" min={0} max={100} value={advancePct}
                onChange={(e) => setAdvancePct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("remainingPctLabel")}</label>
              <input type="text" value={`${100 - advancePct}%`} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono-en text-center" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("advanceAmountLabel")}</label>
              <input type="text" value={total > 0 ? fmtCur(advance) : `0.000 ${t("omr")}`} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("remainingAmountLabel")}</label>
              <input type="text" value={total > 0 ? fmtCur(total - advance) : `0.000 ${t("omr")}`} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono-en" />
            </div>
          </div>

          <div className="border-t border-gray-200 my-5"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("customerNameReq")}</label>
              <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder={t("customerNamePlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("phoneReq")}</label>
              <div className="flex gap-2">
                <select value={customer.phoneCode} onChange={(e) => setCustomer({ ...customer, phoneCode: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-2.5 text-sm w-24 font-mono-en">
                  <option value="+968">+968</option>
                  <option value="+971">+971</option>
                  <option value="+966">+966</option>
                </select>
                <input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                  pattern="[0-9]{8}" maxLength={8}
                  className="flex-1 border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="9XXXXXXX" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("governorateReq")}</label>
              <select value={customer.governorate} onChange={(e) => setCustomer({ ...customer, governorate: e.target.value, wilayat: "" })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm">
                <option value="">{t("chooseGovernorate")}</option>
                {Object.keys(GOVERNORATES).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("wilayatReq")}</label>
              <select value={customer.wilayat} onChange={(e) => setCustomer({ ...customer, wilayat: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" disabled={!customer.governorate}>
                <option value="">{t("chooseWilayat")}</option>
                {wilayats.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
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
                  {renderCategoryBuilder()}

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("quantity")}</label>
                      <input type="number" min={1} value={builderQty} onChange={(e) => setBuilderQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm text-center font-mono-en" />
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
                    className="mt-4 w-full bg-gray-900 text-white font-bold py-3 rounded text-sm hover:bg-gray-800 transition-colors disabled:opacity-30 flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    {t("addToQuote")}
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
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-semibold">{t("noItemsYet")}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="border border-gray-100 rounded p-3 hover:border-gray-300 transition-colors">
                      {editingId === item.id ? (
                        <div className="space-y-2">
                          <input value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-bold" />
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-0.5">{t("quantity")}</label>
                              <input type="number" min={1} value={item.quantity}
                                onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-0.5">{t("unitPriceShort")}</label>
                              <input type="number" min={0} step="0.001" value={item.unitPrice}
                                onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-0.5">{t("extrasShort")}</label>
                              <input type="number" min={0} step="0.001" value={item.extras}
                                onChange={(e) => updateItem(item.id, { extras: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-black font-mono-en">{fmtCur(item.lineTotal)}</span>
                            <button onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-bold hover:bg-gray-800">
                              <Check className="w-3.5 h-3.5" /> {t("done")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 font-semibold">{itemCatName(item)}</p>
                            <p className="text-sm font-bold text-gray-900">{item.description}</p>
                            <p className="text-xs text-gray-500 mt-1 font-mono-en">
                              {item.quantity} x {fmtCur(item.unitPrice)}
                              {item.extras > 0 && ` + ${fmtCur(item.extras)}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
                            <p className="text-sm font-black font-mono-en">{fmtCur(item.lineTotal)}</p>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setEditingId(item.id)}
                                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400" aria-label={t("edit")}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeItem(item.id)}
                                className="p-1.5 rounded border border-red-200 text-red-500 hover:text-red-700 hover:border-red-400" aria-label={t("deleteAction")}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t("subtotal")}</span>
                    <span className="font-bold font-mono-en">{fmtCur(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t("vat")} ({(vatRate * 100).toFixed(0)}%)</span>
                    <span className="font-bold font-mono-en">{fmtCur(vat)}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                    <span className="font-bold">{t("grandTotal")}</span>
                    <span className="font-black font-mono-en text-lg">{fmtCur(total)}</span>
                  </div>
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
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <h2 className="text-base font-bold mb-3">{t("itemDetails")} ({items.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">#</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("item")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("quantity")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("price")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2.5 font-mono-en text-gray-400">{i + 1}</td>
                      <td className="py-2.5">
                        <p className="font-bold">{item.description}</p>
                        <p className="text-xs text-gray-400">{itemCatName(item)}</p>
                      </td>
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
                  className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm resize-none" rows={2}
                  placeholder={t("notesPlaceholder")} />
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
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">{t("subtotal")}</span>
                <span className="font-bold font-mono-en">{fmtCur(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">{t("vat")} ({(vatRate * 100).toFixed(0)}%)</span>
                <span className="font-bold font-mono-en">{fmtCur(vat)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="font-bold text-lg">{t("finalTotal")}</span>
                <span className="text-2xl font-black font-mono-en">{fmtCur(total)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400 text-sm">{t("advancePayment")} ({advancePct}%)</span>
                <span className="font-bold font-mono-en text-green-400">{fmtCur(advance)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="mt-4 max-w-3xl mx-auto bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm font-semibold">
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-between mt-8 max-w-3xl mx-auto">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
          <ArrowRight className="w-4 h-4" />
          {t("previous")}
        </button>

        {step < 4 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed(step)}
            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-30 transition-colors">
            {t("next")}
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving || items.length === 0}
            className="flex items-center gap-2 bg-green-700 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-green-800 disabled:opacity-30 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? t("savingText") : t("saveQuotation")}
          </button>
        )}
      </div>

      {items.length > 0 && step === 3 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 z-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-sm">{items.length} {t("itemsWord")}</span>
          </div>
          <span className="w-px h-5 bg-gray-600" />
          <span className="font-black font-mono-en text-emerald-400">{fmtCur(total)}</span>
          <span className="w-px h-5 bg-gray-600" />
          <button onClick={() => setStep(4)} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
            <Eye className="w-3.5 h-3.5" />
            {t("previewBtn")}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />
            {t("save")}
          </button>
        </div>
      )}
    </div>
  );
}
