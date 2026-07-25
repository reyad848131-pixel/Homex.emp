import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { roundMoney } from "@/lib/utils";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const METHOD_AR: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك",
  card: "بطاقة",
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
    const s = await getSettings();
    const companyName = s.company_name || "Homex";
    const companyPhone = s.company_phone || "";
    const companyAddress = s.company_address || "";
    const companyCR = s.company_cr || "";
    const companyLogo = s.company_logo || "";

    const fmt = (n: number) => roundMoney(n).toFixed(3);
    const fmtDate = (d: Date | string) =>
      new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });

    const totalPaid = roundMoney(q.payments.reduce((sum, p) => sum + p.amount, 0));
    const remaining = roundMoney(Math.max(q.total - totalPaid, 0));
    const receiptNo = `RCPT-${id.slice(-6).toUpperCase()}`;

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سند قبض - ${esc(q.quoteNumber)}</title>
<style>
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, "SF Arabic", "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif; color:#1a1a1a; background:#f2f1ee; line-height:1.7; padding:24px; }
  .receipt { max-width:640px; margin:0 auto; background:#fff; border:1px solid #e2ddd3; border-radius:10px; overflow:hidden; }
  .top { background:#2f3b38; color:#fff; padding:26px 32px; display:flex; align-items:center; gap:18px; }
  .top img { width:64px; height:64px; object-fit:contain; background:rgba(255,255,255,.12); border-radius:8px; padding:4px; }
  .top .co h1 { font-size:22px; font-weight:800; letter-spacing:1px; }
  .top .co p { font-size:12px; opacity:.8; margin-top:2px; }
  .top .stamp { margin-inline-start:auto; text-align:center; }
  .top .stamp .lbl { font-size:11px; opacity:.75; letter-spacing:.2em; }
  .top .stamp .no { font-family:ui-monospace,monospace; font-size:15px; font-weight:700; margin-top:2px; }
  .band { background:#8B9A7B; color:#fff; text-align:center; padding:9px; font-weight:800; font-size:15px; letter-spacing:.05em; }
  .amount { text-align:center; padding:26px 20px 20px; }
  .amount .lbl { font-size:12px; color:#777; }
  .amount .val { font-size:38px; font-weight:900; color:#2f3b38; font-family:ui-monospace,monospace; direction:ltr; }
  .amount .unit { font-size:16px; color:#8B9A7B; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin:0 0 6px; }
  td { padding:11px 32px; font-size:13.5px; border-top:1px solid #eee; }
  td.k { color:#777; width:150px; }
  td.v { font-weight:600; text-align:left; direction:ltr; }
  td.v.rtl { direction:rtl; text-align:right; }
  .summary { display:flex; gap:12px; padding:16px 32px 24px; }
  .box { flex:1; text-align:center; background:#faf8f4; border:1px solid #eee; border-radius:8px; padding:12px; }
  .box .l { font-size:11px; color:#888; }
  .box .n { font-size:16px; font-weight:800; font-family:ui-monospace,monospace; margin-top:3px; }
  .box.paid .n { color:#1f7a34; } .box.rem .n { color:#b4341f; }
  .foot { text-align:center; padding:16px; font-size:11px; color:#999; border-top:1px solid #eee; }
  .sign { display:flex; justify-content:space-between; padding:20px 32px 26px; font-size:12px; color:#666; }
  .sign div { text-align:center; }
  .sign .line { margin-top:34px; border-top:1px dashed #bbb; width:150px; }
  @media print { body { background:#fff; padding:0; } .receipt { border:none; } .noprint { display:none; } }
  .noprint { text-align:center; margin:18px auto 0; max-width:640px; }
  .noprint button { background:#2f3b38; color:#fff; border:none; padding:11px 26px; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="top">
      ${companyLogo ? `<img src="${esc(companyLogo)}" alt="">` : ""}
      <div class="co">
        <h1>${esc(companyName)}</h1>
        ${companyPhone ? `<p>${esc(companyPhone)}</p>` : ""}
        ${companyAddress ? `<p>${esc(companyAddress)}</p>` : ""}
      </div>
      <div class="stamp">
        <div class="lbl">سند قبض</div>
        <div class="no">${esc(receiptNo)}</div>
      </div>
    </div>
    <div class="band">إيصال استلام دفعة</div>

    <div class="amount">
      <div class="lbl">المبلغ المستلم</div>
      <div class="val">${fmt(payment.amount)} <span class="unit">ر.ع</span></div>
    </div>

    <table>
      <tr><td class="k">استلمنا من</td><td class="v rtl">${esc(q.customer.name)}</td></tr>
      <tr><td class="k">عن عرض السعر</td><td class="v">${esc(q.quoteNumber)}</td></tr>
      <tr><td class="k">طريقة الدفع</td><td class="v rtl">${esc(METHOD_AR[payment.method] || payment.method)}</td></tr>
      ${payment.reference ? `<tr><td class="k">المرجع</td><td class="v">${esc(payment.reference)}</td></tr>` : ""}
      <tr><td class="k">التاريخ</td><td class="v rtl">${fmtDate(payment.paidAt)}</td></tr>
      <tr><td class="k">المستلِم</td><td class="v rtl">${esc(payment.recorder?.name)}</td></tr>
      ${companyCR ? `<tr><td class="k">السجل التجاري</td><td class="v">${esc(companyCR)}</td></tr>` : ""}
    </table>

    <div class="summary">
      <div class="box"><div class="l">إجمالي العرض</div><div class="n">${fmt(q.total)}</div></div>
      <div class="box paid"><div class="l">المدفوع</div><div class="n">${fmt(totalPaid)}</div></div>
      <div class="box rem"><div class="l">المتبقّي</div><div class="n">${fmt(remaining)}</div></div>
    </div>

    ${payment.notes ? `<table><tr><td class="k">ملاحظات</td><td class="v rtl">${esc(payment.notes)}</td></tr></table>` : ""}

    <div class="sign">
      <div>المستلِم<div class="line"></div></div>
      <div>العميل<div class="line"></div></div>
    </div>

    <div class="foot">هذا السند بمثابة إيصال رسمي باستلام المبلغ المذكور أعلاه — ${esc(companyName)}</div>
  </div>

  <div class="noprint"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
