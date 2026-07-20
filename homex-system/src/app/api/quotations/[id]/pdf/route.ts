import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

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
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      employee: { select: { id: true, name: true } },
      items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "sales" && quotation.employee.id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyName = await getSetting("company_name", "Homex");
  const companyPhone = await getSetting("company_phone", "+968 97460716");
  const companyAddress = await getSetting("company_address", "بهلاء، محافظة الداخلية، عُمان");
  const companyCR = await getSetting("company_cr", "");
  const companySubtitle = await getSetting("company_subtitle", "مطابخ · خزائن · أثاث مخصص وتصميم داخلي");
  const companyFactory = await getSetting("company_factory", "شركة تابعة لمصنع سلطان النبهاني للمنتجات الخشبية — بهلاء، عُمان");
  const termsConditions = await getSetting("terms_conditions", "");
  const companyLogo = await getSetting("company_logo", "");

  const fmtCur = (n: number) => n.toFixed(3);
  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });

  const itemRows = quotation.items.map((item, i) => `
    <tr>
      <td class="td-cell td-center">${i + 1}</td>
      <td class="td-cell td-desc">${esc(item.description)}</td>
      <td class="td-cell td-center">${item.quantity}</td>
      <td class="td-cell td-num">${fmtCur(item.unitPrice)}</td>
      <td class="td-cell td-num td-bold">${fmtCur(item.lineTotal)}</td>
    </tr>
  `).join("");

  const termsHtml = termsConditions ? (() => {
    const lines = termsConditions.split("\n").filter(Boolean);
    return lines.map((line: string) =>
      `<div class="term-item">– ${esc(line)}</div>`
    ).join("");
  })() : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>عرض سعر - ${quotation.quoteNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');

    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: 'Cairo', 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.6;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 0;
    }

    /* ===== HEADER ===== */
    .header {
      background: #d5d0c8;
      padding: 40px 48px 36px;
      display: flex;
      align-items: center;
      gap: 28px;
    }

    .header-logo {
      flex-shrink: 0;
    }

    .header-logo img {
      width: 100px;
      height: 100px;
      object-fit: contain;
    }

    .logo-placeholder {
      width: 100px;
      height: 100px;
      background: rgba(255,255,255,0.25);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-placeholder svg {
      width: 50px;
      height: 50px;
      opacity: 0.5;
    }

    .header-info {
      flex: 1;
    }

    .header-info h1 {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 3px;
      color: #1a1a1a;
      margin-bottom: 2px;
    }

    .header-subtitle {
      font-size: 14px;
      color: #555;
      font-weight: 500;
    }

    .header-factory {
      font-size: 11px;
      color: #777;
      margin-top: 2px;
    }

    /* ===== INFO TABLE ===== */
    .info-section {
      padding: 0 48px;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 28px;
      border: 1px solid #ddd;
    }

    .info-table td {
      padding: 12px 20px;
      border: 1px solid #ddd;
      font-size: 13px;
      vertical-align: top;
    }

    .info-label {
      width: 120px;
      font-weight: 700;
      color: #1a1a1a;
      background: #fafaf8;
      text-align: right;
    }

    .info-value {
      color: #333;
    }

    .info-value .company-name-val {
      font-weight: 700;
      font-size: 14px;
    }

    .info-value .sub-line {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }

    /* ===== SUBJECT ===== */
    .subject {
      padding: 24px 48px 0;
      margin-bottom: 8px;
    }

    .subject h2 {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .subject p {
      font-size: 12.5px;
      color: #555;
      line-height: 1.7;
    }

    /* ===== SECTION HEADER BAR ===== */
    .section-bar {
      background: #3d3d3d;
      color: #fff;
      padding: 14px 48px;
      font-size: 18px;
      font-weight: 800;
      margin-top: 30px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }

    .section-bar-icon {
      opacity: 0.5;
      width: 22px;
      height: 22px;
    }

    /* ===== ITEMS TABLE ===== */
    .items-section {
      padding: 0 48px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    .items-table thead th {
      background: #f5f5f3;
      color: #555;
      font-size: 12px;
      font-weight: 700;
      padding: 10px 14px;
      text-align: right;
      border-bottom: 2px solid #ddd;
    }

    .td-cell {
      padding: 11px 14px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }

    .td-center { text-align: center; }
    .td-num { font-family: 'Cairo', monospace; text-align: left; direction: ltr; }
    .td-bold { font-weight: 700; }

    .td-desc {
      font-weight: 600;
      max-width: 300px;
    }

    /* ===== TOTALS ===== */
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0;
    }

    .totals-table td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid #eee;
    }

    .totals-label {
      text-align: right;
      font-weight: 600;
      color: #555;
    }

    .totals-value {
      text-align: left;
      font-weight: 700;
      font-family: 'Cairo', monospace;
      direction: ltr;
      width: 140px;
    }

    .totals-spacer {
      border: none !important;
    }

    .grand-total td {
      background: #3d3d3d;
      color: #fff;
      font-size: 15px;
      font-weight: 800;
      padding: 13px 14px;
      border: none;
    }

    .grand-total .totals-value {
      font-size: 16px;
      font-weight: 900;
    }

    /* ===== NOTES ===== */
    .notes-section {
      padding: 20px 48px 0;
    }

    .note-text {
      font-size: 12px;
      color: #777;
      text-align: center;
      margin-top: 16px;
      line-height: 1.7;
    }

    /* ===== PAGE 2: TERMS ===== */
    .terms-page {
      page-break-before: always;
      padding: 0;
    }

    .terms-content {
      padding: 30px 48px 40px;
    }

    .terms-group {
      margin-bottom: 28px;
    }

    .terms-group h3 {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 14px;
      color: #1a1a1a;
    }

    .term-item {
      font-size: 13px;
      color: #444;
      padding: 4px 0;
      line-height: 1.8;
    }

    /* ===== FOOTER ===== */
    .page-footer {
      border-top: 1px solid #ddd;
      padding: 16px 48px;
      text-align: center;
      font-size: 11px;
      color: #999;
      margin-top: 40px;
    }

    @media print {
      body { padding: 0; }
      .page { max-width: 100%; }
      .terms-page { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- ========== HEADER ========== -->
    <div class="header">
      <div class="header-logo">
        ${companyLogo
          ? `<img src="${companyLogo}" alt="${esc(companyName)}" />`
          : `<div class="logo-placeholder">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="35" height="35" rx="2" fill="#888" opacity="0.6"/>
                <rect x="55" y="10" width="35" height="35" rx="2" fill="#888" opacity="0.4"/>
                <rect x="10" y="55" width="35" height="35" rx="2" fill="#888" opacity="0.4"/>
                <rect x="55" y="55" width="35" height="35" rx="2" fill="#888" opacity="0.6"/>
              </svg>
            </div>`
        }
      </div>
      <div class="header-info">
        <h1>${esc(companyName).toUpperCase()}</h1>
        <div class="header-subtitle">${esc(companySubtitle)}</div>
        <div class="header-factory">${esc(companyFactory)}</div>
      </div>
    </div>

    <!-- ========== INFO TABLE ========== -->
    <div class="info-section">
      <table class="info-table">
        <tr>
          <td class="info-label">من شركة</td>
          <td class="info-value">
            <div class="company-name-val">${esc(companyName)}</div>
            ${companyAddress ? `<div class="sub-line">${esc(companyAddress)}</div>` : ""}
            ${companyPhone ? `<div class="sub-line">${esc(companyPhone)}</div>` : ""}
            ${companyCR ? `<div class="sub-line">س.ت: ${esc(companyCR)}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td class="info-label">إلى العميل</td>
          <td class="info-value">
            <div class="company-name-val">${esc(quotation.customer.name)}</div>
            <div class="sub-line">${esc(quotation.customer.phoneCode)} ${esc(quotation.customer.phone)}</div>
            <div class="sub-line">${esc(quotation.customer.governorate)} - ${esc(quotation.customer.wilayat)}</div>
            ${quotation.customer.address ? `<div class="sub-line">${esc(quotation.customer.address)}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td class="info-label">بتاريخ</td>
          <td class="info-value">${fmtDate(quotation.createdAt)}</td>
        </tr>
        <tr>
          <td class="info-label">رقم العرض</td>
          <td class="info-value" style="font-family:'Cairo',monospace;font-weight:600">${esc(quotation.quoteNumber)}</td>
        </tr>
        ${quotation.validUntil ? `
        <tr>
          <td class="info-label">صالح حتى</td>
          <td class="info-value">${fmtDate(quotation.validUntil)}</td>
        </tr>` : ""}
        ${quotation.deliveryDate ? `
        <tr>
          <td class="info-label">موعد التسليم</td>
          <td class="info-value">${fmtDate(quotation.deliveryDate)}</td>
        </tr>` : ""}
      </table>
    </div>

    <!-- ========== SUBJECT ========== -->
    <div class="subject">
      <h2>الموضوع: عرض سعر</h2>
      <p>هذا العرض مقدّم بناءً على المواصفات والبنود المحددة أدناه، من قبل الموظف ${esc(quotation.employee.name)}.</p>
    </div>

    <!-- ========== ITEMS SECTION ========== -->
    <div class="section-bar">
      تفاصيل البنود
    </div>

    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:45px">م</th>
            <th>الوصف</th>
            <th style="width:80px">الكمية</th>
            <th style="width:120px">سعر الوحدة (ر.ع)</th>
            <th style="width:120px">الإجمالي (ر.ع)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals integrated into table style -->
      <table class="totals-table">
        <tr>
          <td class="totals-spacer" colspan="1"></td>
          <td class="totals-label">الإجمالي</td>
          <td class="totals-value">${fmtCur(quotation.subtotal)}</td>
        </tr>
        <tr>
          <td class="totals-spacer" colspan="1"></td>
          <td class="totals-label">ضريبة القيمة المضافة ${(quotation.vatRate * 100).toFixed(0)}%</td>
          <td class="totals-value">${fmtCur(quotation.vatAmount)}</td>
        </tr>
        <tr class="grand-total">
          <td class="totals-spacer" style="background:none"></td>
          <td class="totals-label" style="color:#fff">المبلغ الإجمالي</td>
          <td class="totals-value" style="color:#fff">${fmtCur(quotation.total)}</td>
        </tr>
        ${quotation.advancePct > 0 ? `
        <tr>
          <td class="totals-spacer" colspan="1"></td>
          <td class="totals-label" style="color:#16a34a">الدفعة المقدمة (${quotation.advancePct}%)</td>
          <td class="totals-value" style="color:#16a34a">${fmtCur(quotation.advanceAmount)}</td>
        </tr>` : ""}
      </table>
    </div>

    ${quotation.notes ? `
    <div class="notes-section">
      <div class="note-text">${esc(quotation.notes)}</div>
    </div>` : ""}

    <!-- ========== PAGE 2: TERMS ========== -->
    ${termsConditions ? `
    <div class="terms-page">
      <div class="section-bar">
        الشروط والمواصفات
      </div>
      <div class="terms-content">
        <div class="terms-group">
          ${termsHtml}
        </div>
      </div>

      <div class="page-footer">
        ${esc(companyName)} · ${esc(companyAddress)}
      </div>
    </div>` : ""}

    <!-- ========== FOOTER (page 1) ========== -->
    ${!termsConditions ? `
    <div class="page-footer">
      ${esc(companyName)} · ${esc(companyAddress)}
    </div>` : ""}

  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
