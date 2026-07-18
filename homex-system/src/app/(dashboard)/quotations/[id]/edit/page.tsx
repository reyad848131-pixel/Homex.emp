"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { GOVERNORATES } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus,
  Trash2, ShoppingCart, ArrowLeft, ArrowRight, Save, Check,
} from "lucide-react";
import Link from "next/link";

const ICONS: Record<string, any> = {
  ChefHat, DoorOpen, Lamp, Blinds, Sparkles, BedDouble,
  Layers, Tv, Monitor, Sofa, WashingMachine, Plus,
};

interface Category {
  id: string; nameAr: string; nameEn: string; icon: string;
  pricingType: string; basePrice: number | null; config: any;
}

interface LineItem {
  id: string; categoryId: string; categoryName: string; description: string;
  details: Record<string, any>; quantity: number; unitPrice: number;
  extras: number; lineTotal: number;
}

interface CustomerData {
  name: string; phone: string; phoneCode: string;
  governorate: string; wilayat: string; address: string;
}

export default function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [advancePct, setAdvancePct] = useState(15);
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState("");

  const [customer, setCustomer] = useState<CustomerData>({
    name: "", phone: "", phoneCode: "+968", governorate: "", wilayat: "", address: "",
  });

  const [builderDesc, setBuilderDesc] = useState("");
  const [builderQty, setBuilderQty] = useState(1);
  const [builderPrice, setBuilderPrice] = useState(0);
  const [builderExtras, setBuilderExtras] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/quotations/${id}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([q, cats]) => {
      setCategories(cats);
      setCustomerId(q.customer?.id || "");
      setCustomer({
        name: q.customer?.name || "",
        phone: q.customer?.phone || "",
        phoneCode: q.customer?.phoneCode || "+968",
        governorate: q.customer?.governorate || "",
        wilayat: q.customer?.wilayat || "",
        address: q.customer?.address || "",
      });
      setAdvancePct(q.advancePct || 15);
      setNotes(q.notes || "");
      setItems(
        (q.items || []).map((item: any) => ({
          id: item.id,
          categoryId: item.categoryId,
          categoryName: item.category?.nameAr || "",
          description: item.description,
          details: item.details || {},
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extras: item.extras,
          lineTotal: item.lineTotal,
        }))
      );
      setLoading(false);
    });
  }, [id]);

  const wilayats = customer.governorate ? GOVERNORATES[customer.governorate] || [] : [];
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const vat = subtotal * 0.05;
  const total = subtotal + vat;
  const advance = total * (advancePct / 100);
  const fmtCur = (n: number) => `${n.toFixed(3)} ر.ع`;

  const resetBuilder = useCallback(() => {
    setBuilderDesc(""); setBuilderQty(1); setBuilderPrice(0); setBuilderExtras(0);
  }, []);

  const addItem = () => {
    if (!selectedCat || !builderDesc || builderPrice <= 0) return;
    const lineTotal = builderQty * builderPrice + builderExtras;
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(), categoryId: selectedCat.id, categoryName: selectedCat.nameAr,
      description: builderDesc, details: {}, quantity: builderQty, unitPrice: builderPrice,
      extras: builderExtras, lineTotal,
    }]);
    resetBuilder();
  };

  const removeItem = (itemId: string) => setItems((prev) => prev.filter((i) => i.id !== itemId));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: items.map(({ id: _, categoryName, ...rest }) => rest),
          notes,
          advancePct,
        }),
      });
      if (res.ok) router.push(`/quotations/${id}`);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">جاري التحميل...</div>;

  const steps = [
    { num: 1, label: "بيانات العميل" },
    { num: 2, label: "البنود" },
    { num: 3, label: "المراجعة" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/quotations/${id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">تعديل عرض السعر</h1>
      </div>

      <div className="flex items-center gap-2 mb-8 max-w-lg mx-auto">
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

      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded p-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-bold mb-5">بيانات العميل</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">اسم العميل *</label>
              <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder="الاسم الكامل" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">رقم الهاتف *</label>
              <div className="flex gap-2">
                <select value={customer.phoneCode} onChange={(e) => setCustomer({ ...customer, phoneCode: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-2.5 text-sm w-24 font-mono-en">
                  <option value="+968">+968</option><option value="+971">+971</option><option value="+966">+966</option>
                </select>
                <input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="flex-1 border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="9XXXXXXX" />
              </div>
            </div>
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

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded p-5">
              <h2 className="text-base font-bold mb-4">اختر الفئة</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {categories.map((cat) => {
                  const Icon = ICONS[cat.icon] || Plus;
                  const count = items.filter((i) => i.categoryId === cat.id).length;
                  return (
                    <button key={cat.id} onClick={() => { setSelectedCat(cat); resetBuilder(); }}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-3 border rounded text-xs font-bold transition-all",
                        selectedCat?.id === cat.id ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                      )}>
                      <Icon className="w-5 h-5" />
                      <span className="text-center leading-tight">{cat.nameAr}</span>
                      {count > 0 && (
                        <span className="absolute top-1 left-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCat && (
              <div className="bg-white border border-gray-200 rounded p-5">
                <h2 className="text-base font-bold mb-4">إضافة: {selectedCat.nameAr}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">وصف البند</label>
                    <input type="text" value={builderDesc} onChange={(e) => setBuilderDesc(e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder={`${selectedCat.nameAr} - وصف البند`} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">السعر (ر.ع)</label>
                      <input type="number" step={0.5} min={0} value={builderPrice} onChange={(e) => setBuilderPrice(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">الكمية</label>
                      <input type="number" min={1} value={builderQty} onChange={(e) => setBuilderQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">إضافات</label>
                      <input type="number" step={0.5} min={0} value={builderExtras} onChange={(e) => setBuilderExtras(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
                    </div>
                  </div>
                </div>
                <button onClick={addItem} disabled={!builderDesc || builderPrice <= 0}
                  className="mt-4 w-full bg-gray-900 text-white font-bold py-3 rounded text-sm hover:bg-gray-800 disabled:opacity-30 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> إضافة للعرض
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">البنود المضافة</h2>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="text-center py-8"><ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400 font-semibold">لم تتم إضافة بنود بعد</p></div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="border border-gray-100 rounded p-3 group hover:border-gray-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 font-semibold">{item.categoryName}</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-1 font-mono-en">{item.quantity} x {fmtCur(item.unitPrice)}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="text-sm font-black font-mono-en">{fmtCur(item.lineTotal)}</p>
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 mt-1">
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
                <div className="flex justify-between text-sm"><span className="text-gray-500">المجموع الفرعي</span><span className="font-bold font-mono-en">{fmtCur(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">ضريبة (5%)</span><span className="font-bold font-mono-en">{fmtCur(vat)}</span></div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-200"><span className="font-bold">الإجمالي</span><span className="font-black font-mono-en text-lg">{fmtCur(total)}</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white border border-gray-200 rounded p-5">
            <h2 className="text-base font-bold mb-3">بيانات العميل</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">الاسم:</span> <span className="font-bold">{customer.name}</span></div>
              <div><span className="text-gray-400">الهاتف:</span> <span className="font-bold font-mono-en">{customer.phoneCode} {customer.phone}</span></div>
              <div><span className="text-gray-400">المحافظة:</span> <span className="font-bold">{customer.governorate}</span></div>
              <div><span className="text-gray-400">الولاية:</span> <span className="font-bold">{customer.wilayat}</span></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-5">
            <h2 className="text-base font-bold mb-3">تفاصيل البنود ({items.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">#</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">البند</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">الكمية</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">السعر</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-semibold">الإجمالي</th>
                </tr></thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2.5 font-mono-en text-gray-400">{i + 1}</td>
                      <td className="py-2.5"><p className="font-bold">{item.description}</p><p className="text-xs text-gray-400">{item.categoryName}</p></td>
                      <td className="py-2.5 font-mono-en">{item.quantity}</td>
                      <td className="py-2.5 font-mono-en">{fmtCur(item.unitPrice)}</td>
                      <td className="py-2.5 font-mono-en font-bold">{fmtCur(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">نسبة الدفعة المقدمة (%)</label>
                <input type="number" min={0} max={100} value={advancePct} onChange={(e) => setAdvancePct(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">ملاحظات</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm resize-none" rows={2} placeholder="ملاحظات إضافية (اختياري)" />
              </div>
            </div>
            <div className="bg-gray-900 text-white rounded p-5 mt-5">
              <div className="flex justify-between items-center mb-3"><span className="text-gray-400 text-sm">المجموع الفرعي</span><span className="font-bold font-mono-en">{fmtCur(subtotal)}</span></div>
              <div className="flex justify-between items-center mb-3"><span className="text-gray-400 text-sm">ضريبة (5%)</span><span className="font-bold font-mono-en">{fmtCur(vat)}</span></div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700"><span className="font-bold text-lg">الإجمالي النهائي</span><span className="text-2xl font-black font-mono-en">{fmtCur(total)}</span></div>
              <div className="flex justify-between items-center mt-2"><span className="text-gray-400 text-sm">الدفعة المقدمة ({advancePct}%)</span><span className="font-bold font-mono-en text-green-400">{fmtCur(advance)}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-8 max-w-3xl mx-auto">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30">
          <ArrowRight className="w-4 h-4" /> السابق
        </button>
        {step < 3 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={items.length === 0 && step === 2}
            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-30">
            التالي <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving || items.length === 0}
            className="flex items-center gap-2 bg-green-700 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-green-800 disabled:opacity-30">
            <Save className="w-4 h-4" /> {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        )}
      </div>
    </div>
  );
}
