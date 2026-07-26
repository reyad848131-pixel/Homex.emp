import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { pdfToolbar } from "@/lib/pdf-shell";
import QRCode from "qrcode";

// GCC/ZATCA-style TLV field: tag + length + UTF-8 value.
function tlv(tag: number, value: string): Buffer {
  const val = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag]), Buffer.from([val.length]), val]);
}

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
    const s = await getSettings();
    const companyName = s.company_name || "Homex";
    const companyPhone = s.company_phone || "";
    const companyAddress = s.company_address || "";
    const companyCR = s.company_cr || "";
    const companyLogo = s.company_logo || "";
    const companySubtitle = s.company_subtitle || "";
    const companyFactory = s.company_factory || "";
    const companyVat = s.company_vat || companyCR || "";

    // Tax-invoice QR (seller, VAT no., timestamp, total, VAT) — TLV/base64.
    const tlvData = Buffer.concat([
      tlv(1, companyName),
      tlv(2, companyVat),
      tlv(3, new Date(invoice.issuedAt).toISOString()),
      tlv(4, q.total.toFixed(3)),
      tlv(5, q.vatAmount.toFixed(3)),
    ]).toString("base64");
    let qrDataUrl = "";
    try { qrDataUrl = await QRCode.toDataURL(tlvData, { margin: 1, width: 220 }); } catch {}

    const fmtCur = (n: number) => n.toFixed(3);
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });
    const totalPaid = q.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = q.total - totalPaid;

    const itemRows = q.items.map((item, i) => `
      <tr>
        <td style="padding:9px 12px;border:1px solid #eee;text-align:center">${i + 1}</td>
        <td style="padding:9px 12px;border:1px solid #eee;font-weight:500">${esc(item.description)}</td>
        <td style="padding:9px 12px;border:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:9px 12px;border:1px solid #eee;text-align:left;direction:ltr">${fmtCur(item.unitPrice)}</td>
        <td style="padding:9px 12px;border:1px solid #eee;text-align:left;direction:ltr;font-weight:700">${fmtCur(item.lineTotal)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة - ${invoice.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Cairo',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;line-height:1.6}
    .page{max-width:800px;margin:0 auto}
    .header{background:#d5d0c8;padding:32px 48px 28px;display:flex;align-items:center;position:relative}
    .header-accent{position:absolute;left:0;top:0;bottom:0;width:10px;background:#8B9A7B}
    .header-logo img{width:90px;height:90px;object-fit:contain}
    .header-info{flex:1;text-align:center;padding:0 20px}
    .header-info h1{font-size:32px;font-weight:900;letter-spacing:4px}
    .invoice-badge{display:inline-block;background:#16a34a;color:#fff;padding:6px 24px;font-size:18px;font-weight:800;border-radius:4px;margin-top:8px}
    .info-section{padding:0 48px}
    .info-table{width:100%;border-collapse:collapse;margin-top:24px;border:1px solid #ddd}
    .info-table td{padding:10px 20px;border:1px solid #ddd;font-size:13px;vertical-align:top}
    .info-label{width:110px;font-weight:700;background:#fafaf8}
    .section-bar{background:#16a34a;color:#fff;padding:12px 48px;font-size:16px;font-weight:800;margin-top:24px}
    .items-section{padding:0 48px}
    .items-table{width:100%;border-collapse:collapse;margin-top:16px;border:1px solid #ddd}
    .items-table thead th{background:#f5f5f3;color:#555;font-size:12px;font-weight:700;padding:9px 12px;border:1px solid #ddd;text-align:right}
    .grand-total td{background:#16a34a;color:#fff;font-size:14px;font-weight:800;padding:11px 12px;border:1px solid #16a34a}
    .payment-summary{padding:20px 48px 0}
    .payment-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px 20px;display:flex;justify-content:space-around;text-align:center}
    .payment-box .val{font-size:16px;font-weight:800;font-family:'Cairo',monospace}
    .payment-box .lbl{font-size:11px;color:#555;margin-top:2px}
    .footer{border-top:1px solid #ddd;padding:14px 48px;text-align:center;font-size:11px;color:#999;margin-top:30px}
    @media print{body{padding:0}.page{max-width:100%}}
  </style>
</head>
<body>
  ${pdfToolbar(`/quotations/${q.id}`)}
  <div class="page">
    <div class="header">
      <div class="header-accent"></div>
      <div style="flex-shrink:0">
        ${companyLogo ? `<img src="${companyLogo}" alt="${esc(companyName)}" style="width:90px;height:90px;object-fit:contain">` : ""}
      </div>
      <div class="header-info">
        <h1>${esc(companyName).toUpperCase()}</h1>
        ${companySubtitle ? `<div style="font-size:13px;color:#555">${esc(companySubtitle)}</div>` : ""}
        <div class="invoice-badge">فاتورة</div>
      </div>
    </div>

    <div class="info-section">
      <table class="info-table">
        <tr><td class="info-label">رقم الفاتورة</td><td style="font-weight:700;font-family:'Cairo',monospace">${esc(invoice.invoiceNumber)}</td></tr>
        <tr><td class="info-label">رقم العرض</td><td style="font-family:'Cairo',monospace">${esc(q.quoteNumber)}</td></tr>
        <tr><td class="info-label">تاريخ الإصدار</td><td>${fmtDate(invoice.issuedAt)}</td></tr>
        <tr><td class="info-label">العميل</td><td><strong>${esc(q.customer.name)}</strong><br><span style="color:#666">${esc(q.customer.phoneCode)} ${esc(q.customer.phone)} · ${esc(q.customer.governorate)} – ${esc(q.customer.wilayat)}</span></td></tr>
        <tr><td class="info-label">الشركة</td><td><strong>${esc(companyName)}</strong>${companyAddress ? `<br><span style="color:#666">${esc(companyAddress)}</span>` : ""}${companyCR ? `<br><span style="color:#666">س.ت: ${esc(companyCR)}</span>` : ""}${companyVat ? `<br><span style="color:#666">الرقم الضريبي: ${esc(companyVat)}</span>` : ""}${companyPhone ? `<br><span style="color:#666">${esc(companyPhone)}</span>` : ""}</td></tr>
      </table>
    </div>

    <div class="section-bar">تفاصيل البنود</div>
    <div class="items-section">
      <table class="items-table">
        <thead><tr><th style="width:40px;text-align:center">م</th><th>الوصف</th><th style="width:80px;text-align:center">الكمية</th><th style="width:115px;text-align:center">سعر الوحدة (ر.ع)</th><th style="width:115px;text-align:center">الإجمالي (ر.ع)</th></tr></thead>
        <tbody>
          ${itemRows}
          <tr><td colspan="4" style="padding:9px 12px;border:1px solid #eee;text-align:right;font-weight:700">الإجمالي</td><td style="padding:9px 12px;border:1px solid #eee;text-align:left;direction:ltr;font-weight:700">${fmtCur(q.subtotal)}</td></tr>
          <tr><td colspan="4" style="padding:9px 12px;border:1px solid #eee;text-align:right;font-weight:700">ضريبة القيمة المضافة ${(q.vatRate * 100).toFixed(0)}%</td><td style="padding:9px 12px;border:1px solid #eee;text-align:left;direction:ltr;font-weight:700">${fmtCur(q.vatAmount)}</td></tr>
          <tr class="grand-total"><td colspan="4" style="text-align:right;color:#fff">المبلغ الإجمالي</td><td style="text-align:left;direction:ltr;color:#fff;font-weight:900">${fmtCur(q.total)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="payment-summary">
      <div style="display:flex;gap:16px;align-items:stretch">
        <div class="payment-box" style="flex:1">
          <div><div class="val">${fmtCur(q.total)}</div><div class="lbl">إجمالي الفاتورة</div></div>
          <div><div class="val" style="color:#16a34a">${fmtCur(totalPaid)}</div><div class="lbl">المدفوع</div></div>
          <div><div class="val" style="color:${remaining > 0 ? '#dc2626' : '#16a34a'}">${fmtCur(remaining)}</div><div class="lbl">المتبقي</div></div>
        </div>
        ${qrDataUrl ? `<div style="flex-shrink:0;text-align:center;border:1px solid #e5e7eb;border-radius:6px;padding:8px">
          <img src="${qrDataUrl}" alt="QR" style="width:96px;height:96px;display:block">
          <div style="font-size:9px;color:#999;margin-top:4px">فاتورة ضريبية</div>
        </div>` : ""}
      </div>
    </div>

    <div class="footer">${esc(companyName)}${companyFactory ? ` · ${esc(companyFactory)}` : ""} · ${esc(companyAddress)}</div>
  </div>
</body>
</html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/invoices/[id]/pdf]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
