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
      return await prisma.quotation.findFirst({
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
  const companySubtitle = s.company_subtitle || "مطابخ · خزائن · أثاث مخصص وتصميم داخلي";
  const logo = s.company_logo || "";
  const phone = s.company_phone || "";
  const terms = s.terms_conditions || "";
  const remaining = (q.total || 0) - (q.advanceAmount || 0);
  const monogram = (companyName.trim()[0] || "H").toUpperCase();

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 py-6 px-4 font-cairo">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Company letterhead — mirrors the official quotation document */}
        <div className="rounded-2xl shadow-sm overflow-hidden bg-gradient-to-br from-[#3d3d3d] to-[#2a2a28] relative">
          <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 shrink-0 rounded-xl border border-white/30 bg-white/5 flex items-center justify-center overflow-hidden">
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl font-extrabold text-white">{monogram}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-mono-en font-bold text-white text-2xl tracking-[0.28em] uppercase leading-tight">{companyName}</h1>
              <p className="text-[11px] text-white/70 mt-1.5 leading-snug">{companySubtitle}</p>
              {phone && <p className="text-[11px] text-white/50 mt-0.5 font-mono-en" dir="ltr">{phone}</p>}
            </div>
            <div className="text-left shrink-0">
              <p className="text-[10px] tracking-[0.15em] uppercase text-white/50">عرض سعر</p>
              <p className="font-bold font-mono-en text-white text-lg mt-0.5">{q.quoteNumber}</p>
            </div>
          </div>
          <div className="h-[3px] bg-gradient-to-l from-[#8b9a7b] to-transparent" />
        </div>

        {/* Customer + items */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex justify-between text-sm mb-4">
            <div>
              <p className="text-[11px] tracking-wide uppercase text-[#6f7e62] font-bold">العميل</p>
              <p className="font-bold text-gray-900 mt-0.5">{q.customer.name}</p>
            </div>
            <div className="text-left">
              <p className="text-[11px] tracking-wide uppercase text-[#6f7e62] font-bold">المنطقة</p>
              <p className="font-semibold text-gray-700 mt-0.5">{q.customer.governorate} — {q.customer.wilayat}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-xs">
                  <th className="text-right py-2.5 px-3 rounded-s-lg font-bold">البند</th>
                  <th className="text-center py-2.5 px-2 font-bold">الكمية</th>
                  <th className="text-left py-2.5 px-3 rounded-e-lg font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it, i) => (
                  <tr key={it.id} className={`border-b border-gray-100 ${i % 2 ? "bg-gray-50" : ""}`}>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-gray-800">{it.description}</p>
                      <p className="text-xs text-gray-400">{it.category?.nameAr}</p>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono-en text-gray-500">{it.quantity}</td>
                    <td className="py-2.5 px-3 text-left font-mono-en font-bold text-[#6f7e62]">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">الإجمالي الفرعي</span><span className="font-mono-en font-bold">{money(q.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الضريبة ({Math.round((q.vatRate || 0) * 100)}%)</span><span className="font-mono-en font-bold">{money(q.vatAmount)}</span></div>
            <div className="flex justify-between items-center bg-gray-800 text-white rounded-xl px-4 py-3 mt-3"><span className="font-extrabold">الإجمالي</span><span className="font-mono-en font-black text-base">{money(q.total)}</span></div>
            {q.advancePct > 0 && (
              <div className="flex justify-between items-center bg-[#eef0ea] text-[#6f7e62] rounded-lg px-4 py-2.5 mt-2"><span className="font-bold">الدفعة المقدمة ({q.advancePct}%)</span><span className="font-mono-en font-bold">{money(q.advanceAmount)}</span></div>
            )}
            <div className="flex justify-between text-gray-500 px-1 pt-1"><span>المتبقّي</span><span className="font-mono-en">{money(remaining)}</span></div>
          </div>

          {/* Download the official branded PDF straight from this page. */}
          <a href={`/api/public/quote/${token}/pdf-file`} target="_blank" rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3.5 rounded-xl transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            تحميل عرض السعر PDF
          </a>
        </div>

        {q.status === "accepted" && (() => {
          // Simplified customer-facing stages, in order. `reached` = index of the
          // stage currently active (earlier stages are done); a value beyond the
          // last stage means the whole order is complete.
          const STAGES = ["تأكيد الطلب", "التصنيع", "التوصيل"];
          const REACHED: Record<string, number> = {
            needs_preparation: 1, ready_to_execute: 1, in_progress: 1,
            completed: 2, ready_for_delivery: 2,
            delivered: 3,
          };
          const reached = q.workStatus ? (REACHED[q.workStatus] ?? 1) : 1;
          const allDone = reached >= STAGES.length;
          return (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-4 rounded bg-[#8b9a7b]" />
                <p className="text-sm font-extrabold text-gray-800">تتبّع طلبك</p>
              </div>
              <div className="space-y-0">
                {STAGES.map((label, i) => {
                  const done = reached > i;
                  const current = reached === i;
                  const last = i === STAGES.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          done ? "bg-[#8b9a7b] text-white"
                          : current ? "bg-white border-2 border-[#8b9a7b] text-[#6f7e62]"
                          : "bg-gray-100 border border-gray-200 text-gray-400"}`}>
                          {done ? "✓" : i + 1}
                        </div>
                        {!last && <div className={`w-0.5 flex-1 min-h-[26px] ${done ? "bg-[#8b9a7b]" : "bg-gray-200"}`} />}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-bold ${done ? "text-[#6f7e62]" : current ? "text-gray-900" : "text-gray-400"}`}>{label}</p>
                        {current && <p className="text-xs text-[#8b9a7b] font-semibold mt-0.5">الحالية</p>}
                        {i === 2 && q.deliveryDate && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            الموعد: <span className="font-mono-en font-bold">{new Date(q.deliveryDate).toLocaleDateString("en-GB")}</span>
                            {q.deliveryTime ? <span className="font-mono-en"> — {q.deliveryTime}</span> : null}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {allDone && <p className="text-sm font-black text-[#6f7e62] mt-2 text-center">تم تسليم طلبك بالكامل ✅ شكراً لثقتك</p>}
            </div>
          );
        })()}

        {terms && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-4 rounded bg-[#8b9a7b]" />
              <p className="text-sm font-extrabold text-gray-800">الشروط والأحكام</p>
            </div>
            <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{terms}</p>
          </div>
        )}

        {/* Contract signature + decision — placed at the bottom, under the terms. */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <QuoteDecision token={token} initialStatus={q.status} customerName={q.customer.name} />
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          <span className="font-mono-en font-bold tracking-widest text-gray-500 uppercase">{companyName}</span> · نظام عروض الأسعار
        </p>
      </div>
    </div>
  );
}
