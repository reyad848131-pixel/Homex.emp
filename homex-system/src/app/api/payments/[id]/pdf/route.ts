import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { pdfToolbar } from "@/lib/pdf-shell";
import {
  loadBrand, esc, iconLines, brandCss, watermarkHtml, letterheadHtml,
  footerHtml, printDateStr,
} from "@/lib/pdf-brand";

// Official payment receipt (سند قبض) — same premium brand identity as the
// quotation and invoice (Cairo + Montserrat, Iridium + sage, letterhead /
// watermark / footer), with a hero "amount received" block.
const METHOD_AR: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك",
  card: "بطاقة",
  financing: "تمويل",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        recorder: { select: { name: true } },
        quotation: {
          include: {
            customer: true,
            payments: { select: { amount: true } },
          },
        },
      },
    });

    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // A sales rep may only access receipts for their own quotations.
    if (user.role === "sales" && payment.quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = payment.quotation;
    const b = await loadBrand();

    const fmt = (n: number) => roundMoney(n).toFixed(3);
    const fmtDate = (d: Date | string) =>
      new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });

    const totalPaid = roundMoney(q.payments.reduce((sum, p) => sum + p.amount, 0));
    const remaining = roundMoney(Math.max(q.total - totalPaid, 0));
    const receiptNo = `RCPT-${id.slice(-6).toUpperCase()}`;

    const kv = (k: string, v: string, ltr = false) =>
      `<div class="kv"><div class="kk">${esc(k)}</div><div class="vv"${ltr ? ' style="direction:ltr;text-align:left"' : ""}>${v}</div></div>`;

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سند قبض - ${esc(receiptNo)}</title>
${brandCss()}
<style>
  .hero{margin:26px 44px 0;background:linear-gradient(135deg,var(--green) 0%,var(--green-2) 100%);color:#fff;border-radius:16px;padding:26px 30px;text-align:center;position:relative;overflow:hidden}
  .hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--sage),transparent 60%)}
  .hero .l{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.7)}
  .hero .val{font-size:44px;font-weight:900;font-variant-numeric:tabular-nums;direction:ltr;margin-top:6px;line-height:1}
  .hero .val .u{font-size:18px;font-weight:700;color:var(--sage)}
  .kvgrid{margin:26px 44px 0;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .kv{display:flex;border-bottom:1px solid var(--line)}
  .kv:last-child{border-bottom:none}
  .kv:nth-child(even){background:var(--panel)}
  .kv .kk{width:160px;flex-shrink:0;padding:12px 18px;color:var(--sage-d);font-weight:700;font-size:12px;letter-spacing:.3px;border-inline-end:1px solid var(--line)}
  .kv .vv{flex:1;padding:12px 18px;font-weight:600;font-size:13px;color:var(--ink)}
  .sign-cols{display:flex;gap:28px;margin:30px 44px 0}
  .sign-box{flex:1;text-align:center}
  .sign-box .t{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--sage-d);font-weight:700}
  .sign-box .line{margin-top:40px;border-top:1.5px dashed var(--line)}
</style>
</head>
<body>
${pdfToolbar(`/quotations/${q.id}`)}
<div class="page">
  ${watermarkHtml(b)}

  ${letterheadHtml(b, "سند قبض", receiptNo, `<div class="badge paid">إيصال دفعة</div>`)}

  <!-- HERO AMOUNT -->
  <div class="hero">
    <div class="l">المبلغ المستلم</div>
    <div class="val">${fmt(payment.amount)} <span class="u">ر.ع</span></div>
  </div>

  <!-- DETAILS -->
  <div class="sec"><span class="bar"></span><span class="ic">${iconLines}</span><h2>تفاصيل الدفعة</h2><span class="rule"></span></div>
  <div class="kvgrid">
    ${kv("استلمنا من", esc(q.customer.name))}
    ${kv("عن عرض السعر", esc(q.quoteNumber), true)}
    ${kv("طريقة الدفع", esc(METHOD_AR[payment.method] || payment.method))}
    ${payment.reference ? kv("المرجع", esc(payment.reference), true) : ""}
    ${kv("التاريخ", fmtDate(payment.paidAt))}
    ${payment.recorder?.name ? kv("المستلِم", esc(payment.recorder.name)) : ""}
    ${payment.notes ? kv("ملاحظات", esc(payment.notes)) : ""}
  </div>

  <!-- PAYMENT STATUS -->
  <div class="paybar">
    <div class="paybox total"><div class="l">إجمالي العرض</div><div class="n">${fmt(q.total)} <span class="u">ر.ع</span></div></div>
    <div class="paybox paid"><div class="l">إجمالي المدفوع</div><div class="n">${fmt(totalPaid)} <span class="u">ر.ع</span></div></div>
    <div class="paybox ${remaining > 0 ? "due" : "paid"}"><div class="l">المتبقّي</div><div class="n">${fmt(remaining)} <span class="u">ر.ع</span></div></div>
  </div>

  <!-- SIGNATURES -->
  <div class="sign-cols">
    <div class="sign-box"><div class="t">المستلِم</div><div class="line"></div></div>
    <div class="sign-box"><div class="t">العميل</div><div class="line"></div></div>
  </div>

  <div class="note">هذا السند بمثابة إيصال رسمي باستلام المبلغ المذكور أعلاه، صادر عن ${esc(b.companyName)}.</div>

  ${await footerHtml(b, printDateStr())}
</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("API error [/api/payments/[id]/pdf]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
