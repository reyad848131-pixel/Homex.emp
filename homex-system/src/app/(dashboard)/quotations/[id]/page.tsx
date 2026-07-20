"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { STATUS_MAP } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Printer, Trash2, CheckCircle, XCircle, Send,
  Clock, FileText, User, MapPin, Phone, Pencil, Download, Copy, MessageCircle, CalendarDays,
  CreditCard, Plus, Banknote,
} from "lucide-react";
import Link from "next/link";

interface QuotationDetail {
  id: string;
  quoteNumber: string;
  status: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  advancePct: number;
  advanceAmount: number;
  notes: string | null;
  validUntil: string | null;
  deliveryDate: string | null;
  createdAt: string;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string; address: string | null };
  employee: { id: string; name: string; civilId: string };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    extras: number;
    lineTotal: number;
    category: { nameAr: string; nameEn: string };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    notes: string | null;
    paidAt: string;
    recorder: { name: string };
  }>;
}

const PAYMENT_METHODS: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك",
  card: "بطاقة",
};

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [q, setQ] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState("");
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  const fmtCur = (n: number) => `${n.toFixed(3)} ر.ع`;

  useEffect(() => {
    fetch(`/api/quotations/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setQ)
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setTerms(s.terms_conditions || ""))
      .catch(() => {});
  }, [id]);

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/quotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setQ((prev) => prev ? { ...prev, status: data.status } : prev);
    }
  };

  const handleDelete = async () => {
    if (!confirm("هل أنت متأكد من حذف هذا العرض؟")) return;
    const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/quotations");
  };

  const handlePrint = () => window.print();

  const handleDuplicate = async () => {
    if (!q) return;
    const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/quotations/${data.id}/edit`);
    }
  };

  const handleWhatsApp = () => {
    if (!q) return;
    const text = encodeURIComponent(
      `*عرض سعر - ${q.quoteNumber}*\n` +
      `العميل: ${q.customer.name}\n` +
      `الإجمالي: ${fmtCur(q.total)}\n` +
      `الدفعة المقدمة (${q.advancePct}%): ${fmtCur(q.advanceAmount)}\n\n` +
      `البنود:\n` +
      q.items.map((item, i) => `${i + 1}. ${item.description} - ${fmtCur(item.lineTotal)}`).join("\n") +
      `\n\n--- Homex ---`
    );
    const phone = q.customer.phone.replace(/\D/g, "");
    const code = (q.customer.phoneCode || "+968").replace(/\D/g, "");
    const fullPhone = phone.startsWith(code) ? phone : `${code}${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${text}`, "_blank");
  };

  const handleAddPayment = async () => {
    if (!q || !payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: q.id,
          amount: Number(payAmount),
          method: payMethod,
          reference: payRef || null,
          notes: payNotes || null,
        }),
      });
      if (res.ok) {
        const payment = await res.json();
        setQ((prev) => prev ? { ...prev, payments: [payment, ...prev.payments] } : prev);
        setPayAmount("");
        setPayRef("");
        setPayNotes("");
        setShowPayForm(false);
      }
    } catch {} finally { setPaying(false); }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">جاري التحميل...</div>;
  if (!q) return <div className="text-center py-20 text-red-500">عرض السعر غير موجود</div>;

  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;

  const groupedItems: Record<string, typeof q.items> = {};
  q.items.forEach((item) => {
    const cat = item.category.nameAr;
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });

  return (
    <>
      {/* Screen View */}
      <div className="no-print">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/quotations" className="text-gray-400 hover:text-gray-600">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="font-mono-en">{q.quoteNumber}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${status.color}`}>{status.label}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              أنشئ بواسطة {q.employee.name} - {new Date(q.createdAt).toLocaleDateString("ar-OM")}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
              <Download className="w-4 h-4" />
              PDF
            </a>
            <button onClick={handleWhatsApp}
              className="flex items-center gap-2 px-4 py-2 border border-green-200 text-green-600 rounded text-sm font-bold hover:bg-green-50">
              <MessageCircle className="w-4 h-4" />
              واتساب
            </button>
            <button onClick={handleDuplicate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
              <Copy className="w-4 h-4" />
              نسخ
            </button>
            {(q.status === "draft" || q.status === "pending") && (
              <Link href={`/quotations/${id}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
                <Pencil className="w-4 h-4" />
                تعديل
              </Link>
            )}
            {q.status === "draft" && (
              <button onClick={() => updateStatus("pending")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">
                <Send className="w-4 h-4" />
                إرسال للمراجعة
              </button>
            )}
            {q.status === "pending" && (
              <>
                <button onClick={() => updateStatus("approved")}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" />
                  اعتماد
                </button>
                <button onClick={() => updateStatus("declined")}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700">
                  <XCircle className="w-4 h-4" />
                  رفض
                </button>
              </>
            )}
            <button onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded text-sm font-bold hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Info */}
          <div className="bg-white border border-gray-200 rounded p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> بيانات العميل
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold">{q.customer.name}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Phone className="w-4 h-4" />
                <span className="font-mono-en">{q.customer.phoneCode} {q.customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                <span>{q.customer.governorate} - {q.customer.wilayat}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CalendarDays className="w-4 h-4" />
                <span>صالح حتى: {q.validUntil ? new Date(q.validUntil).toLocaleDateString("ar-OM") : "—"}</span>
              </div>
              {q.deliveryDate && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>موعد التسليم: {new Date(q.deliveryDate).toLocaleDateString("ar-OM")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> تفاصيل البنود ({q.items.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">#</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">البند</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">الكمية</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">السعر</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">الإضافات</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedItems).map(([catName, catItems]) => (
                    <>
                      <tr key={catName}>
                        <td colSpan={6} className="py-2 bg-gray-50 px-3 font-bold text-xs text-gray-500 uppercase">
                          {catName}
                        </td>
                      </tr>
                      {catItems.map((item, i) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-2.5 font-mono-en text-gray-400">{i + 1}</td>
                          <td className="py-2.5 font-semibold">{item.description}</td>
                          <td className="py-2.5 font-mono-en">{item.quantity}</td>
                          <td className="py-2.5 font-mono-en">{fmtCur(item.unitPrice)}</td>
                          <td className="py-2.5 font-mono-en">{item.extras > 0 ? fmtCur(item.extras) : "-"}</td>
                          <td className="py-2.5 font-mono-en font-bold">{fmtCur(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 mt-4 pt-4 space-y-2 max-w-xs mr-auto">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المجموع الفرعي</span>
                <span className="font-bold font-mono-en">{fmtCur(q.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ضريبة القيمة المضافة ({(q.vatRate * 100).toFixed(0)}%)</span>
                <span className="font-bold font-mono-en">{fmtCur(q.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
                <span className="font-bold">الإجمالي</span>
                <span className="font-black font-mono-en">{fmtCur(q.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">الدفعة المقدمة ({q.advancePct}%)</span>
                <span className="font-bold font-mono-en text-green-600">{fmtCur(q.advanceAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {q.notes && (
          <div className="bg-white border border-gray-200 rounded p-5 mt-6">
            <h2 className="text-sm font-bold text-gray-400 mb-2">ملاحظات</h2>
            <p className="text-sm text-gray-700">{q.notes}</p>
          </div>
        )}

        {terms && (
          <div className="bg-white border border-gray-200 rounded p-5 mt-6">
            <h2 className="text-sm font-bold text-gray-400 mb-3">الشروط والأحكام</h2>
            <ul className="space-y-1.5">
              {terms.split("\n").filter(Boolean).map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-gray-300 mt-0.5">•</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Payments Section */}
        {q.status === "approved" && (() => {
          const totalPaid = q.payments.reduce((s, p) => s + p.amount, 0);
          const remaining = q.total - totalPaid;
          const paidPct = q.total > 0 ? (totalPaid / q.total) * 100 : 0;
          return (
            <div className="bg-white border border-gray-200 rounded mt-6">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Banknote className="w-4 h-4" /> المدفوعات
                </h2>
                <button onClick={() => setShowPayForm(!showPayForm)}
                  className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors">
                  <Plus className="w-4 h-4" /> تسجيل دفعة
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono-en text-green-600">{paidPct.toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-xs text-gray-400">الإجمالي</p>
                    <p className="font-bold font-mono-en">{fmtCur(q.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">المدفوع</p>
                    <p className="font-bold font-mono-en text-green-600">{fmtCur(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">المتبقي</p>
                    <p className="font-bold font-mono-en text-red-600">{fmtCur(remaining)}</p>
                  </div>
                </div>

                {showPayForm && remaining > 0 && (
                  <div className="border border-gray-200 rounded p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">المبلغ *</label>
                        <input type="number" step="0.001" min="0.001" max={remaining}
                          value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                          className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono-en"
                          placeholder={`الحد الأقصى ${remaining.toFixed(3)}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">طريقة الدفع</label>
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                          className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                          {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">رقم المرجع</label>
                      <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono-en" placeholder="اختياري" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">ملاحظات</label>
                      <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm" placeholder="اختياري" />
                    </div>
                    <button onClick={handleAddPayment} disabled={paying || !payAmount || Number(payAmount) <= 0}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
                      <CreditCard className="w-4 h-4" />
                      {paying ? "جاري التسجيل..." : "تسجيل الدفعة"}
                    </button>
                  </div>
                )}

                {q.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-right py-2 text-xs text-gray-400">المبلغ</th>
                          <th className="text-right py-2 text-xs text-gray-400">الطريقة</th>
                          <th className="text-right py-2 text-xs text-gray-400">المرجع</th>
                          <th className="text-right py-2 text-xs text-gray-400">بواسطة</th>
                          <th className="text-right py-2 text-xs text-gray-400">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.payments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-2 font-mono-en font-bold text-green-600">{fmtCur(p.amount)}</td>
                            <td className="py-2 text-gray-500">{PAYMENT_METHODS[p.method] || p.method}</td>
                            <td className="py-2 font-mono-en text-gray-400 text-xs">{p.reference || "—"}</td>
                            <td className="py-2 text-gray-500 text-xs">{p.recorder.name}</td>
                            <td className="py-2 font-mono-en text-gray-400 text-xs">{new Date(p.paidAt).toLocaleDateString("ar-OM")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">لا توجد دفعات مسجلة</p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Print View */}
      <div className="hidden print:block p-8" dir="rtl">
        <div className="text-center mb-8 border-b-2 border-gray-900 pb-6">
          <h1 className="text-3xl font-black">HOMEX</h1>
          <p className="text-sm text-gray-500 mt-1">عرض سعر</p>
          <p className="text-xs text-gray-400 mt-2 font-mono-en">{q.quoteNumber}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div>
            <h3 className="font-bold text-gray-500 text-xs uppercase mb-2">بيانات العميل</h3>
            <p className="font-bold text-lg">{q.customer.name}</p>
            <p className="text-gray-600">{q.customer.phoneCode} {q.customer.phone}</p>
            <p className="text-gray-600">{q.customer.governorate} - {q.customer.wilayat}</p>
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-500 text-xs uppercase mb-2">تفاصيل العرض</h3>
            <p>التاريخ: {new Date(q.createdAt).toLocaleDateString("ar-OM")}</p>
            <p>صالح حتى: {q.validUntil ? new Date(q.validUntil).toLocaleDateString("ar-OM") : "-"}</p>
            {q.deliveryDate && <p>موعد التسليم: {new Date(q.deliveryDate).toLocaleDateString("ar-OM")}</p>}
            <p>الموظف: {q.employee.name}</p>
          </div>
        </div>

        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-right p-2 border">#</th>
              <th className="text-right p-2 border">البند</th>
              <th className="text-right p-2 border">الكمية</th>
              <th className="text-right p-2 border">سعر الوحدة</th>
              <th className="text-right p-2 border">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => (
              <tr key={item.id} className="border">
                <td className="p-2 border">{i + 1}</td>
                <td className="p-2 border font-semibold">{item.description}</td>
                <td className="p-2 border text-center">{item.quantity}</td>
                <td className="p-2 border font-mono-en">{fmtCur(item.unitPrice)}</td>
                <td className="p-2 border font-mono-en font-bold">{fmtCur(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>المجموع الفرعي</span><span className="font-bold font-mono-en">{fmtCur(q.subtotal)}</span></div>
            <div className="flex justify-between"><span>ضريبة ({(q.vatRate * 100).toFixed(0)}%)</span><span className="font-mono-en">{fmtCur(q.vatAmount)}</span></div>
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 text-lg">
              <span className="font-bold">الإجمالي</span>
              <span className="font-black font-mono-en">{fmtCur(q.total)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>دفعة مقدمة ({q.advancePct}%)</span>
              <span className="font-bold font-mono-en">{fmtCur(q.advanceAmount)}</span>
            </div>
          </div>
        </div>

        {terms && (
          <div className="mt-8 pt-4 border-t">
            <h3 className="font-bold text-sm mb-2">الشروط والأحكام:</h3>
            <ul className="space-y-1 text-xs text-gray-600">
              {terms.split("\n").filter(Boolean).map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 pt-4 border-t text-center text-xs text-gray-400">
          <p>Homex - نظام عروض الأسعار الداخلي</p>
        </div>
      </div>
    </>
  );
}
