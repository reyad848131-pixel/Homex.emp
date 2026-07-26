import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { QuoteDecision } from "./decision";

export const dynamic = "force-dynamic";

function money(n: number) {
  return `${(n || 0).toFixed(3)} ر.ع`;
}

// Neon (free tier) auto-suspends the DB; the first query after idle can fail
// while it wakes. Retry a couple of times before giving up.
async function loadQuote(token: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.quotation.findUnique({
        where: { publicToken: token },
        include: {
          customer: { select: { name: true, governorate: true, wilayat: true } },
          items: { include: { category: { select: { nameAr: true } } }, orderBy: { sortOrder: "asc" } },
        },
      });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let q;
  try {
    q = await loadQuote(token);
  } catch (e) {
    console.error("Public quote load failed:", e);
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <p className="text-lg font-bold text-gray-800">تعذّر تحميل العرض</p>
          <p className="text-sm text-gray-500 mt-2">حدّث الصفحة بعد لحظات، أو تواصل مع الشركة.</p>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <p className="text-lg font-bold text-gray-800">الرابط غير صالح</p>
          <p className="text-sm text-gray-500 mt-2">تأكّد من الرابط أو تواصل مع الشركة.</p>
        </div>
      </div>
    );
  }

  const s = await getSettings().catch(() => ({} as Record<string, string>));
  const companyName = s.company_name || "homex";
  const logo = s.company_logo || "";
  const phone = s.company_phone || "";
  const terms = s.terms_conditions || "";
  const remaining = (q.total || 0) - (q.advanceAmount || 0);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 py-6 px-4 font-cairo">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Company header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4">
          {logo ? (
            <img src={logo} alt="" className="w-14 h-14 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xl font-black">H</div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900">{companyName}</h1>
            {phone && <p className="text-sm text-gray-400" dir="ltr">{phone}</p>}
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-400">عرض سعر</p>
            <p className="font-bold font-mono-en text-gray-900">{q.quoteNumber}</p>
          </div>
        </div>

        {/* Customer + items */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex justify-between text-sm mb-4">
            <div>
              <p className="text-gray-400">العميل</p>
              <p className="font-bold text-gray-900">{q.customer.name}</p>
            </div>
            <div className="text-left">
              <p className="text-gray-400">المنطقة</p>
              <p className="font-semibold text-gray-700">{q.customer.governorate} — {q.customer.wilayat}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-right py-2">البند</th>
                  <th className="text-center py-2">الكمية</th>
                  <th className="text-left py-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <p className="font-semibold text-gray-800">{it.description}</p>
                      <p className="text-xs text-gray-400">{it.category?.nameAr}</p>
                    </td>
                    <td className="py-2.5 text-center font-mono-en text-gray-500">{it.quantity}</td>
                    <td className="py-2.5 text-left font-mono-en font-bold">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">الإجمالي الفرعي</span><span className="font-mono-en font-bold">{money(q.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الضريبة ({Math.round((q.vatRate || 0) * 100)}%)</span><span className="font-mono-en font-bold">{money(q.vatAmount)}</span></div>
            <div className="flex justify-between text-base pt-2 border-t border-gray-100"><span className="font-bold">الإجمالي</span><span className="font-mono-en font-black">{money(q.total)}</span></div>
            <div className="flex justify-between text-gray-500"><span>الدفعة المقدمة ({q.advancePct}%)</span><span className="font-mono-en">{money(q.advanceAmount)}</span></div>
            <div className="flex justify-between text-gray-500"><span>المتبقّي</span><span className="font-mono-en">{money(remaining)}</span></div>
          </div>
        </div>

        {/* Decision */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <QuoteDecision token={token} initialStatus={q.status} />
        </div>

        {terms && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="text-xs font-bold text-gray-400 mb-2">الشروط والأحكام</p>
            <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{terms}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">{companyName} · نظام عروض الأسعار</p>
      </div>
    </div>
  );
}
