"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GOVERNORATES } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus,
  Trash2, ShoppingCart, ArrowLeft, ArrowRight, Save, Check,
} from "lucide-react";

const ICONS: Record<string, any> = {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus,
};

interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  pricingType: string;
  basePrice: number | null;
  config: any;
}

interface LineItem {
  id: string;
  categoryId: string;
  categoryName: string;
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
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [advancePct, setAdvancePct] = useState(15);
  const [notes, setNotes] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");

  const [customer, setCustomer] = useState<CustomerData>({
    name: "", phone: "", phoneCode: "+968",
    governorate: "", wilayat: "", address: "",
  });

  // Builder state
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderQty, setBuilderQty] = useState(1);
  const [builderPrice, setBuilderPrice] = useState(0);
  const [builderExtras, setBuilderExtras] = useState(0);
  const [builderDetails, setBuilderDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
    fetch("/api/me").then((r) => r.json()).then((u) => setEmployeeName(u.name || ""));
  }, []);

  const wilayats = customer.governorate ? GOVERNORATES[customer.governorate] || [] : [];

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const vat = subtotal * 0.05;
  const total = subtotal + vat;
  const advance = total * (advancePct / 100);

  const fmtCur = (n: number) => `${n.toFixed(3)} ر.ع`;

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

  const addItem = () => {
    if (!selectedCat || !builderDesc || builderPrice <= 0) return;
    const lineTotal = builderQty * builderPrice + builderExtras;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        categoryId: selectedCat.id,
        categoryName: selectedCat.nameAr,
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
    if (s === 1) return customer.name && customer.phone && customer.governorate && customer.wilayat;
    if (s === 2) return selectedCat !== null;
    if (s === 3) return items.length > 0;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: items.map(({ id, categoryName, ...rest }) => rest),
          notes,
          advancePct,
          quoteDate,
          deliveryDate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/quotations/${data.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryBuilder = () => {
    if (!selectedCat) return null;
    const config = selectedCat.config || {};

    switch (selectedCat.id) {
      case "kitchens": return <KitchenBuilder config={config} onUpdate={handleBuilderUpdate} />;
      case "cabinets": return <CabinetBuilder config={config} onUpdate={handleBuilderUpdate} />;
      case "curtains": return <CurtainBuilder config={config} onUpdate={handleBuilderUpdate} />;
      case "bed": return <BedBuilder config={config} onUpdate={handleBuilderUpdate} />;
      case "cladding": return <CladdingBuilder config={config} onUpdate={handleBuilderUpdate} />;
      case "sofa-set": return <SofaBuilder config={config} onUpdate={handleBuilderUpdate} />;
      default: return <GenericBuilder cat={selectedCat} onUpdate={handleBuilderUpdate} />;
    }
  };

  const steps = [
    { num: 1, label: "بيانات الزبون" },
    { num: 2, label: "اختر الأقسام" },
    { num: 3, label: "البنود" },
    { num: 4, label: "المراجعة" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">إنشاء عرض سعر جديد</h1>

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
        <div className="bg-white border border-gray-200 rounded p-6 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold mb-5">بيانات الزبون وعرض السعر</h2>

          {/* Row 1: Employee + Quote No + Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">اسم الموظف</label>
              <input type="text" value={employeeName} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">رقم عرض السعر</label>
              <input type="text" value="تلقائي عند الحفظ" readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-400 font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">التاريخ</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
          </div>

          {/* Row 2: Delivery Date + Advance % + Remaining % */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">موعد التسليم</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">نسبة الدفعة المقدمة (%)</label>
              <input type="number" min={0} max={100} value={advancePct}
                onChange={(e) => setAdvancePct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">نسبة المتبقي (%)</label>
              <input type="text" value={`${100 - advancePct}%`} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono-en text-center" />
            </div>
          </div>

          {/* Row 3: Advance Amount + Remaining Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">مبلغ الدفعة المقدمة</label>
              <input type="text" value={total > 0 ? fmtCur(advance) : "0.000 ر.ع"} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">مبلغ المتبقي</label>
              <input type="text" value={total > 0 ? fmtCur(total - advance) : "0.000 ر.ع"} readOnly
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono-en" />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-5"></div>

          {/* Row 4: Customer Name + Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">اسم الزبون *</label>
              <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder="اسم الزبون الكامل" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">رقم الهاتف *</label>
              <div className="flex gap-2">
                <select value={customer.phoneCode} onChange={(e) => setCustomer({ ...customer, phoneCode: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-2.5 text-sm w-24 font-mono-en">
                  <option value="+968">+968</option>
                  <option value="+971">+971</option>
                  <option value="+966">+966</option>
                </select>
                <input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="flex-1 border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="9XXXXXXX" />
              </div>
            </div>
          </div>

          {/* Row 5: Governorate + Wilayat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">المحافظة *</label>
              <select value={customer.governorate} onChange={(e) => setCustomer({ ...customer, governorate: e.target.value, wilayat: "" })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm">
                <option value="">اختر المحافظة</option>
                {Object.keys(GOVERNORATES).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الولاية *</label>
              <select value={customer.wilayat} onChange={(e) => setCustomer({ ...customer, wilayat: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" disabled={!customer.governorate}>
                <option value="">اختر الولاية</option>
                {wilayats.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Choose Categories */}
      {step === 2 && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded p-5">
            <div className="mb-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">الخطوة 2 من 4</p>
              <h2 className="text-lg font-bold">اختر القسم</h2>
              <p className="text-sm text-gray-500">حسب طلب الزبون — يقدر يختار أكثر من قسم لنفس عرض السعر</p>
            </div>
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
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                    )}>
                    <Icon className="w-6 h-6" />
                    <span className="text-center leading-tight">{cat.nameAr}</span>
                    {count > 0 && (
                      <span className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
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
            {/* Selected Category Header */}
            <div className="bg-white border border-gray-200 rounded p-5">
              <div className="mb-4">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">الخطوة 3 من 4</p>
                <h2 className="text-lg font-bold">إضافة بنود — {selectedCat?.nameAr}</h2>
              </div>

              {/* Category Tabs (mini) */}
              <div className="flex gap-2 flex-wrap mb-4">
                {categories.map((cat) => {
                  const Icon = ICONS[cat.icon] || Plus;
                  const count = items.filter((i) => i.categoryId === cat.id).length;
                  return (
                    <button key={cat.id} onClick={() => { setSelectedCat(cat); resetBuilder(); }}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-bold transition-all",
                        selectedCat?.id === cat.id
                          ? "bg-gray-900 border-gray-900 text-white"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                      )}>
                      <Icon className="w-3.5 h-3.5" />
                      {cat.nameAr}
                      {count > 0 && (
                        <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Item Builder */}
              {selectedCat && (
                <>
                  {renderCategoryBuilder()}

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">الكمية</label>
                      <input type="number" min={1} value={builderQty} onChange={(e) => setBuilderQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm text-center font-mono-en" />
                    </div>
                    <div className="flex items-end">
                      <div className="bg-gray-100 rounded px-4 py-2.5 text-center w-full">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">إجمالي البند</p>
                        <p className="text-lg font-black font-mono-en text-gray-900">
                          {fmtCur(builderQty * builderPrice + builderExtras)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button onClick={addItem} disabled={!builderDesc || builderPrice <= 0}
                    className="mt-4 w-full bg-gray-900 text-white font-bold py-3 rounded text-sm hover:bg-gray-800 transition-colors disabled:opacity-30 flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    إضافة للعرض
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Items Summary Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">البنود المضافة</h2>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-semibold">لم تتم إضافة بنود بعد</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="border border-gray-100 rounded p-3 group hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-semibold">{item.categoryName}</p>
                          <p className="text-sm font-bold text-gray-900 truncate">{item.description}</p>
                          <p className="text-xs text-gray-500 mt-1 font-mono-en">
                            {item.quantity} x {fmtCur(item.unitPrice)}
                            {item.extras > 0 && ` + ${fmtCur(item.extras)}`}
                          </p>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="text-sm font-black font-mono-en">{fmtCur(item.lineTotal)}</p>
                          <button onClick={() => removeItem(item.id)}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">المجموع الفرعي</span>
                    <span className="font-bold font-mono-en">{fmtCur(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ضريبة القيمة المضافة (5%)</span>
                    <span className="font-bold font-mono-en">{fmtCur(vat)}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                    <span className="font-bold">الإجمالي</span>
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
          {/* Customer Summary */}
          <div className="bg-white border border-gray-200 rounded p-5">
            <h2 className="text-base font-bold mb-3">بيانات العميل</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">الاسم:</span> <span className="font-bold">{customer.name}</span></div>
              <div><span className="text-gray-400">الهاتف:</span> <span className="font-bold font-mono-en">{customer.phoneCode} {customer.phone}</span></div>
              <div><span className="text-gray-400">المحافظة:</span> <span className="font-bold">{customer.governorate}</span></div>
              <div><span className="text-gray-400">الولاية:</span> <span className="font-bold">{customer.wilayat}</span></div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-gray-200 rounded p-5">
            <h2 className="text-base font-bold mb-3">تفاصيل البنود ({items.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">#</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">البند</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">الكمية</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">السعر</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2.5 font-mono-en text-gray-400">{i + 1}</td>
                      <td className="py-2.5">
                        <p className="font-bold">{item.description}</p>
                        <p className="text-xs text-gray-400">{item.categoryName}</p>
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

          {/* Totals + Options */}
          <div className="bg-white border border-gray-200 rounded p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">ملاحظات</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm resize-none" rows={2}
                  placeholder="ملاحظات إضافية (اختياري)" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">نسبة الدفعة المقدمة</span>
                  <span className="font-bold font-mono-en">{advancePct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">مبلغ الدفعة المقدمة</span>
                  <span className="font-bold font-mono-en text-green-600">{fmtCur(advance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">المبلغ المتبقي</span>
                  <span className="font-bold font-mono-en">{fmtCur(total - advance)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 text-white rounded p-5 mt-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">المجموع الفرعي</span>
                <span className="font-bold font-mono-en">{fmtCur(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">ضريبة القيمة المضافة (5%)</span>
                <span className="font-bold font-mono-en">{fmtCur(vat)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="font-bold text-lg">الإجمالي النهائي</span>
                <span className="text-2xl font-black font-mono-en">{fmtCur(total)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400 text-sm">الدفعة المقدمة ({advancePct}%)</span>
                <span className="font-bold font-mono-en text-green-400">{fmtCur(advance)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 max-w-3xl mx-auto">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
          <ArrowRight className="w-4 h-4" />
          السابق
        </button>

        {step < 4 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed(step)}
            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-30 transition-colors">
            التالي
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving || items.length === 0}
            className="flex items-center gap-2 bg-green-700 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-green-800 disabled:opacity-30 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ عرض السعر"}
          </button>
        )}
      </div>

      {/* Floating Summary */}
      {items.length > 0 && step === 3 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 z-50">
          <span className="font-bold text-sm">{items.length} بنود</span>
          <span className="text-gray-400">|</span>
          <span className="font-black font-mono-en">{fmtCur(total)}</span>
        </div>
      )}
    </div>
  );
}

// === Category-specific builders ===

function KitchenBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const [region, setRegion] = useState("muscat");
  const [units, setUnits] = useState("2unit");
  const [width, setWidth] = useState(3);
  const [height, setHeight] = useState(2.4);
  const [porcelain, setPorcelain] = useState(false);
  const [island, setIsland] = useState<string>("");

  useEffect(() => {
    const regionPrice = config.regions?.[region]?.price || 120;
    const mult = config.multipliers?.[units] || 1;
    const area = width * height;
    const price = area * regionPrice * mult;
    let extras = 0;
    if (porcelain) extras += config.porcelainSurcharge || 55;
    if (island === "small") extras += config.island?.small || 390;
    if (island === "large") extras += config.island?.large || 600;

    const unitLabel = units === "3unit" ? "3 وحدات" : "وحدتين";
    const desc = `مطبخ MDF - ${unitLabel} - ${width}×${height}م`;
    onUpdate(desc, price, extras);
  }, [region, units, width, height, porcelain, island, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">المنطقة</label>
        <div className="flex gap-2">
          {[["muscat", "مسقط"], ["batinah", "الباطنة"], ["other", "أخرى"]].map(([k, l]) => (
            <button key={k} onClick={() => setRegion(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                region === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">عدد الوحدات</label>
        <div className="flex gap-2">
          {[["2unit", "وحدتين (علوي + سفلي)"], ["3unit", "3 وحدات"]].map(([k, l]) => (
            <button key={k} onClick={() => setUnits(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                units === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">العرض (م)</label>
          <input type="number" step={0.1} min={1} value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 1)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">الارتفاع (م)</label>
          <input type="number" step={0.1} min={1} value={height} onChange={(e) => setHeight(parseFloat(e.target.value) || 1)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={porcelain} onChange={(e) => setPorcelain(e.target.checked)} className="rounded" />
          بورسلين (+{config.porcelainSurcharge || 55} ر.ع)
        </label>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">جزيرة مطبخ</label>
        <div className="flex gap-2">
          {[["", "بدون"], ["small", `صغيرة (${config.island?.small || 390})`], ["large", `كبيرة (${config.island?.large || 600})`]].map(([k, l]) => (
            <button key={k} onClick={() => setIsland(k)}
              className={cn("flex-1 py-2 rounded text-xs font-bold border transition-colors",
                island === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CabinetBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const [width, setWidth] = useState(1.5);
  const [height, setHeight] = useState(2.4);
  const [shape, setShape] = useState("single");
  const [glassDoors, setGlassDoors] = useState(0);
  const [leds, setLeds] = useState(0);

  useEffect(() => {
    const area = width * height;
    const price = area * (config.basePrice || 54);
    const extras = glassDoors * (config.glassDoor || 60) + leds * (config.led || 25);
    const desc = `خزانة ${shape === "L" ? "L" : shape === "U" ? "U" : "عادية"} - ${width}×${height}م`;
    onUpdate(desc, price, extras);
  }, [width, height, shape, glassDoors, leds, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">الشكل</label>
        <div className="flex gap-2">
          {[["single", "عادية"], ["L", "L شكل"], ["U", "U شكل"]].map(([k, l]) => (
            <button key={k} onClick={() => setShape(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                shape === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">العرض (م)</label>
          <input type="number" step={0.1} min={0.5} value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0.5)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">الارتفاع (م)</label>
          <input type="number" step={0.1} min={0.5} value={height} onChange={(e) => setHeight(parseFloat(e.target.value) || 0.5)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">أبواب زجاج ({config.glassDoor || 60} ر.ع/باب)</label>
          <input type="number" min={0} value={glassDoors} onChange={(e) => setGlassDoors(parseInt(e.target.value) || 0)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">إضاءة LED ({config.led || 25} ر.ع)</label>
          <input type="number" min={0} value={leds} onChange={(e) => setLeds(parseInt(e.target.value) || 0)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      </div>
    </div>
  );
}

function CurtainBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const [type, setType] = useState("chiffon");
  const [meters, setMeters] = useState(3);
  const [motor, setMotor] = useState(false);

  const typeLabels: Record<string, string> = { chiffon: "شيفون", blackout: "بلاك أوت", both: "شيفون + بلاك أوت" };

  useEffect(() => {
    const pricePerMeter = config.types?.[type] || 8;
    const price = meters * pricePerMeter;
    let extras = 0;
    if (motor) extras = (config.electricMotor?.base || 45) + meters * (config.electricMotor?.perMeter || 5);
    const desc = `ستائر ${typeLabels[type]} - ${meters} م`;
    onUpdate(desc, price, extras);
  }, [type, meters, motor, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">النوع</label>
        <div className="flex gap-2">
          {Object.entries(typeLabels).map(([k, l]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">الطول (م)</label>
        <input type="number" step={0.5} min={1} value={meters} onChange={(e) => setMeters(parseFloat(e.target.value) || 1)}
          className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={motor} onChange={(e) => setMotor(e.target.checked)} className="rounded" />
        موتور كهربائي
      </label>
    </div>
  );
}

function BedBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const [type, setType] = useState("wood");
  const [size, setSize] = useState("180x200");
  const [lighting, setLighting] = useState(false);

  useEffect(() => {
    const price = config.sizes?.[size] || 160;
    const extras = lighting ? (config.lighting || 20) : 0;
    const typeLabel = config.types?.[type] || type;
    const desc = `سرير ${typeLabel} - ${size} سم`;
    onUpdate(desc, price, extras);
  }, [type, size, lighting, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">النوع</label>
        <div className="flex gap-2">
          {Object.entries(config.types || { wood: "خشب", fabric: "قماش" }).map(([k, l]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l as string}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">المقاس</label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(config.sizes || {}).map(([s, p]) => (
            <button key={s} onClick={() => setSize(s)}
              className={cn("py-2 rounded text-xs font-bold border transition-colors",
                size === s ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={lighting} onChange={(e) => setLighting(e.target.checked)} className="rounded" />
        إضاءة (+{config.lighting || 20} ر.ع)
      </label>
    </div>
  );
}

function CladdingBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const [type, setType] = useState("wood");
  const [width, setWidth] = useState(2);
  const [height, setHeight] = useState(2.5);
  const [lighting, setLighting] = useState(false);

  const typeLabels: Record<string, string> = { wood: "خشب", pvc: "PVC", fabric: "قماش", stone: "حجر" };

  useEffect(() => {
    const area = width * height;
    const pricePerSqm = config.types?.[type] || 35;
    const price = area * pricePerSqm;
    const extras = lighting ? (config.lighting || 15) : 0;
    const desc = `كلادينق ${typeLabels[type]} - ${width}×${height}م`;
    onUpdate(desc, price, extras);
  }, [type, width, height, lighting, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">نوع الكلادينق</label>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(typeLabels).map(([k, l]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors min-w-[70px]",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">العرض (م)</label>
          <input type="number" step={0.1} min={0.5} value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0.5)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">الارتفاع (م)</label>
          <input type="number" step={0.1} min={0.5} value={height} onChange={(e) => setHeight(parseFloat(e.target.value) || 0.5)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={lighting} onChange={(e) => setLighting(e.target.checked)} className="rounded" />
        إضاءة (+{config.lighting || 15} ر.ع)
      </label>
    </div>
  );
}

function SofaBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const [type, setType] = useState("standard");
  const [price, setPrice] = useState(config.standard?.min || 80);

  useEffect(() => {
    const typeLabel = type === "wooden" ? "خشبي" : "عادي";
    const desc = `طقم جلوس ${typeLabel}`;
    onUpdate(desc, price, 0);
  }, [type, price, onUpdate]);

  const range = config[type] || { min: 80, max: 95 };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">النوع</label>
        <div className="flex gap-2">
          {[["standard", "عادي"], ["wooden", "خشبي"]].map(([k, l]) => (
            <button key={k} onClick={() => { setType(k); setPrice(config[k]?.min || 80); }}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">السعر ({range.min} - {range.max} ر.ع)</label>
        <input type="range" min={range.min} max={range.max} value={price}
          onChange={(e) => setPrice(parseInt(e.target.value))}
          className="w-full accent-gray-900" />
        <p className="text-center text-lg font-black font-mono-en mt-2">{price} ر.ع</p>
      </div>
    </div>
  );
}

function GenericBuilder({ cat, onUpdate }: { cat: Category; onUpdate: (d: string, p: number, e: number) => void }) {
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(cat.basePrice || 0);
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [lighting, setLighting] = useState(false);

  useEffect(() => {
    const config = cat.config || {};
    let calculatedPrice = price;
    let extras = 0;

    if (cat.pricingType === "per_sqm") {
      const area = width * height;
      calculatedPrice = area * (config.pricePerSqm || cat.basePrice || 50);
    } else if (cat.pricingType === "per_meter") {
      calculatedPrice = width * (config.pricePerMeter || cat.basePrice || 120);
    }

    if (lighting && config.lighting) extras = config.lighting;

    const finalDesc = desc || `${cat.nameAr} - ${cat.pricingType === "manual" ? "بند مخصص" : `${width}${cat.pricingType === "per_sqm" ? `×${height}م` : "م"}`}`;
    onUpdate(finalDesc, calculatedPrice, extras);
  }, [desc, price, width, height, lighting, cat, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">وصف البند</label>
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm"
          placeholder={`${cat.nameAr} - وصف البند`} />
      </div>

      {cat.pricingType === "manual" ? (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">السعر (ر.ع)</label>
          <input type="number" step={0.5} min={0} value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
              {cat.pricingType === "per_meter" ? "الطول (م)" : "العرض (م)"}
            </label>
            <input type="number" step={0.1} min={0.5} value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0.5)}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
          {cat.pricingType === "per_sqm" && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الارتفاع (م)</label>
              <input type="number" step={0.1} min={0.5} value={height} onChange={(e) => setHeight(parseFloat(e.target.value) || 0.5)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
            </div>
          )}
        </div>
      )}

      {cat.config?.lighting && (
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={lighting} onChange={(e) => setLighting(e.target.checked)} className="rounded" />
          إضاءة (+{cat.config.lighting} ر.ع)
        </label>
      )}
    </div>
  );
}
