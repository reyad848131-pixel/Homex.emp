import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      employee: { select: { name: true } },
      items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const companyName = await getSetting("company_name", "Homex");
  const companyPhone = await getSetting("company_phone", "");
  const companyAddress = await getSetting("company_address", "");
  const companyCR = await getSetting("company_cr", "");
  const termsConditions = await getSetting("terms_conditions", "");

  const fmtCur = (n: number) => `${n.toFixed(3)} ر.ع`;
  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });

  const itemRows = quotation.items.map((item, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
      <td style="padding:8px;border:1px solid #ddd;font-weight:600">${item.description}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.category.nameAr}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border:1px solid #ddd;font-family:monospace">${fmtCur(item.unitPrice)}</td>
      <td style="padding:8px;border:1px solid #ddd;font-family:monospace">${item.extras > 0 ? fmtCur(item.extras) : "-"}</td>
      <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-weight:700">${fmtCur(item.lineTotal)}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>عرض سعر - ${quotation.quoteNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Cairo',sans-serif; font-size:13px; color:#1a1a1a; padding:40px; max-width:800px; margin:auto; }
    .header { text-align:center; border-bottom:3px solid #171717; padding-bottom:24px; margin-bottom:24px; }
    .header h1 { font-size:32px; font-weight:900; letter-spacing:2px; }
    .header .subtitle { color:#666; font-size:14px; margin-top:4px; }
    .header .quote-num { font-family:monospace; color:#999; font-size:12px; margin-top:8px; }
    .meta { display:flex; justify-content:space-between; margin-bottom:24px; }
    .meta-box { width:48%; }
    .meta-box h3 { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; font-weight:700; }
    .meta-box p { margin:3px 0; }
    .meta-box .name { font-size:16px; font-weight:700; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    th { background:#171717; color:#fff; padding:8px; text-align:right; font-size:11px; font-weight:700; }
    .totals { display:flex; justify-content:flex-start; }
    .totals-box { width:260px; }
    .totals-row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; }
    .totals-row.grand { border-top:3px solid #171717; padding-top:10px; margin-top:4px; font-size:16px; }
    .totals-row .label { color:#555; }
    .totals-row .value { font-weight:700; font-family:monospace; }
    .advance { color:#16a34a; }
    .notes { background:#f9f9f9; padding:16px; border-radius:6px; margin-top:20px; }
    .notes h3 { font-size:12px; color:#888; margin-bottom:6px; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid #ddd; text-align:center; color:#aaa; font-size:11px; }
    .company-info { font-size:11px; color:#888; margin-top:4px; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName.toUpperCase()}</h1>
    <div class="subtitle">عرض سعر</div>
    <div class="quote-num">${quotation.quoteNumber}</div>
    ${companyCR ? `<div class="company-info">س.ت: ${companyCR}</div>` : ""}
  </div>

  <div class="meta">
    <div class="meta-box">
      <h3>بيانات العميل</h3>
      <p class="name">${quotation.customer.name}</p>
      <p>${quotation.customer.phoneCode} ${quotation.customer.phone}</p>
      <p>${quotation.customer.governorate} - ${quotation.customer.wilayat}</p>
      ${quotation.customer.address ? `<p>${quotation.customer.address}</p>` : ""}
    </div>
    <div class="meta-box" style="text-align:left">
      <h3>تفاصيل العرض</h3>
      <p>التاريخ: ${fmtDate(quotation.createdAt)}</p>
      <p>صالح حتى: ${quotation.validUntil ? fmtDate(quotation.validUntil) : "-"}</p>
      <p>الموظف: ${quotation.employee.name}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>البند</th>
        <th>الفئة</th>
        <th style="width:60px">الكمية</th>
        <th style="width:100px">سعر الوحدة</th>
        <th style="width:80px">إضافات</th>
        <th style="width:110px">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span class="label">المجموع الفرعي</span>
        <span class="value">${fmtCur(quotation.subtotal)}</span>
      </div>
      <div class="totals-row">
        <span class="label">ضريبة القيمة المضافة (${(quotation.vatRate * 100).toFixed(0)}%)</span>
        <span class="value">${fmtCur(quotation.vatAmount)}</span>
      </div>
      <div class="totals-row grand">
        <span style="font-weight:900">الإجمالي</span>
        <span class="value" style="font-weight:900;font-size:18px">${fmtCur(quotation.total)}</span>
      </div>
      <div class="totals-row advance">
        <span>الدفعة المقدمة (${quotation.advancePct}%)</span>
        <span class="value">${fmtCur(quotation.advanceAmount)}</span>
      </div>
    </div>
  </div>

  ${quotation.notes ? `
  <div class="notes">
    <h3>ملاحظات</h3>
    <p>${quotation.notes}</p>
  </div>` : ""}

  ${termsConditions ? `
  <div style="margin-top:24px;padding:16px;border:1px solid #ddd;border-radius:6px">
    <h3 style="font-size:13px;font-weight:700;margin-bottom:10px">الشروط والأحكام:</h3>
    <ul style="list-style:none;padding:0;margin:0">
      ${termsConditions.split("\n").filter(Boolean).map((line: string) =>
        `<li style="padding:3px 0;font-size:12px;color:#444">• ${line}</li>`
      ).join("")}
    </ul>
  </div>` : ""}

  <div class="footer">
    <p>${companyName} - نظام عروض الأسعار</p>
    ${companyPhone ? `<p>${companyPhone}</p>` : ""}
    ${companyAddress ? `<p>${companyAddress}</p>` : ""}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
