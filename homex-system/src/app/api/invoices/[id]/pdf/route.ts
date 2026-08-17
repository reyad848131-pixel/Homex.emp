import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pdfToolbar } from "@/lib/pdf-shell";
import {
  loadBrand, esc, iconLines, brandCss, watermarkHtml, letterheadHtml,
  footerHtml, printDateStr, makeQr,
} from "@/lib/pdf-brand";

// GCC/ZATCA-style TLV field: tag + length + UTF-8 value.
function tlv(tag: number, value: string): Buffer {
  const val = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag]), Buffer.from([val.length]), val]);
}

// Official tax invoice — same premium brand identity as the quotation
// (Cairo + Montserrat, Iridium + sage, letterhead / watermark / footer),
// with the payment summary and the ZATCA tax QR.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        quotation: {
          include: {
            customer: true,
            employee: { select: { name: true } },
            items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
            payments: { orderBy: { paidAt: "desc" } },
          },
        },
        issuer: { select: { name: true } },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // A sales rep may only access invoices for their own quotations (IDOR guard).
    if (user.role === "sales" && invoice.quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = invoice.quotation;
    const b = await loadBrand();

    // Tax-invoice QR (seller, VAT no., timestamp, total, VAT) — TLV/base64.
    const tlvData = Buffer.concat([
      tlv(1, b.companyName),
      tlv(2, b.companyVat),
      tlv(3, new Date(invoice.issuedAt).toISOString()),
      tlv(4, q.total.toFixed(3)),
      tlv(5, q.vatAmount.toFixed(3)),
    ]).toString("base64");
    const qrTax = await makeQr(tlvData);

    const fmtCur = (n: number) => n.toFixed(3);
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });
    const totalPaid = q.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = q.total - totalPaid;
    const fullyPaid = remaining <= 0.0005;

    const itemRows = q.items.map((item, i) => `
      <tr>
        <td class="c-idx">${i + 1}</td>
        <td class="c-desc">${esc(item.description)}</td>
        <td class="c-qty">${item.quantity}</td>
        <td class="c-num">${fmtCur(item.unitPrice)}</td>
        <td class="c-num c-strong">${fmtCur(item.lineTotal)}</td>
      </tr>`).join("");

    const badge = fullyPaid
      ? `<div class="badge paid">مدفوعة ✓</div>`
      : (totalPaid > 0 ? `<div class="badge due">مدفوعة جزئياً</div>` : `<div class="badge due">غير مدفوعة</div>`);

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>فاتورة ضريبية - ${esc(invoice.invoiceNumber)}</title>
${brandCss()}
</head>
<body>
${pdfToolbar(`/quotations/${q.id}`)}
<div class="page">
  ${watermarkHtml(b)}

  ${letterheadHtml(b, "فاتورة ضريبية", invoice.invoiceNumber, badge)}

  <!-- META -->
  <div class="meta">
    <div class="meta-col">
      <div class="meta-k">من</div>
      <div class="meta-name">${esc(b.companyName)}</div>
      ${b.companyAddress ? `<div class="meta-line">${esc(b.companyAddress)}</div>` : ""}
      ${b.companyPhone ? `<div class="meta-line num">${esc(b.companyPhone)}</div>` : ""}
      ${b.companyVat ? `<div class="meta-line">الرقم الضريبي: ${esc(b.companyVat)}</div>` : ""}
    </div>
    <div class="meta-col right">
      <div class="meta-k">إلى العميل</div>
      <div class="meta-name">${esc(q.customer.name)}</div>
      <div class="meta-line num">${esc(q.customer.phoneCode)} ${esc(q.customer.phone)}</div>
      <div class="meta-line">${esc(q.customer.governorate)} – ${esc(q.customer.wilayat)}</div>
      ${q.customer.address ? `<div class="meta-line">${esc(q.customer.address)}</div>` : ""}
    </div>
  </div>

  <!-- FACTS -->
  <div class="facts">
    <div class="fact"><div class="k">تاريخ الإصدار</div><div class="v">${fmtDate(invoice.issuedAt)}</div></div>
    <div class="fact"><div class="k">رقم العرض</div><div class="v num">${esc(q.quoteNumber)}</div></div>
    ${invoice.issuer?.name ? `<div class="fact"><div class="k">أصدرها</div><div class="v">${esc(invoice.issuer.name)}</div></div>` : ""}
  </div>

  <!-- ITEMS -->
  <div class="sec"><span class="bar"></span><span class="ic">${iconLines}</span><h2>تفاصيل البنود</h2><span class="rule"></span></div>
  <table class="items">
    <thead><tr>
      <th class="ta-c" style="width:38px">م</th><th>الوصف</th>
      <th class="ta-c" style="width:64px">الكمية</th>
      <th class="ta-c" style="width:120px">سعر الوحدة (ر.ع)</th>
      <th class="ta-c" style="width:120px">الإجمالي (ر.ع)</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS: tax QR on the right, totals card on the left -->
  <div class="totals">
    ${qrTax ? `<div class="totals-qr">
      <div class="tq"><img src="${qrTax}" alt="Tax QR" /><div class="cap"><b>فاتورة ضريبية</b><br/>امسح للتحقق</div></div>
    </div>` : ""}
    <div class="totals-card">
      <div class="tt sub"><span class="l">الإجمالي الفرعي</span><span class="v">${fmtCur(q.subtotal)} <span style="color:var(--muted);font-weight:600">ر.ع</span></span></div>
      <div class="tt"><span class="l">ضريبة القيمة المضافة ${(q.vatRate * 100).toFixed(0)}%</span><span class="v">${fmtCur(q.vatAmount)}</span></div>
      <div class="tt grand"><span class="l">المبلغ الإجمالي</span><span class="v">${fmtCur(q.total)} ر.ع</span></div>
    </div>
  </div>

  <!-- PAYMENT STATUS -->
  <div class="paybar">
    <div class="paybox total"><div class="l">إجمالي الفاتورة</div><div class="n">${fmtCur(q.total)} <span class="u">ر.ع</span></div></div>
    <div class="paybox paid"><div class="l">المدفوع</div><div class="n">${fmtCur(totalPaid)} <span class="u">ر.ع</span></div></div>
    <div class="paybox ${remaining > 0 ? "due" : "paid"}"><div class="l">المتبقّي</div><div class="n">${fmtCur(Math.max(remaining, 0))} <span class="u">ر.ع</span></div></div>
  </div>

  <div class="note">هذه فاتورة ضريبية رسمية صادرة عن ${esc(b.companyName)}. يُرجى الاحتفاظ بها للمراجعة. رمز الاستجابة السريعة أعلاه يتضمن بيانات الفاتورة الضريبية.</div>

  ${await footerHtml(b, printDateStr())}
</div>
</body>
</html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/invoices/[id]/pdf]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
