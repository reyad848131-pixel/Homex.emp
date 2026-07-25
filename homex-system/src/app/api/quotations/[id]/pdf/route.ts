import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

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

  const s = await getSettings();
  const companyName = s.company_name || "Homex";
  const companyPhone = s.company_phone || "+968 97460716";
  const companyAddress = s.company_address || "بهلاء، محافظة الداخلية، عُمان";
  const companyCR = s.company_cr || "";
  const companySubtitle = s.company_subtitle || "مطابخ · خزائن · أثاث مخصص وتصميم داخلي";
  const companyFactory = s.company_factory || "شركة تابعة لمصنع سلطان النبهاني للمنتجات الخشبية — بهلاء، عُمان";
  const termsConditions = s.terms_conditions || "";
  const companyLogo = s.company_logo || "";
  const companyWebsite = s.company_website || "";

  const fmtCur = (n: number) => n.toFixed(3);
  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });
  const now = new Date();
  const printDate = `${now.getDate().toString().padStart(2,"0")}/${(now.getMonth()+1).toString().padStart(2,"0")}/${now.getFullYear()}, ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")} ${now.getHours() >= 12 ? "PM" : "AM"}`;

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
    const sections: { title: string; items: string[] }[] = [];
    let current: { title: string; items: string[] } | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        if (current) sections.push(current);
        current = { title: trimmed.replace(/^#+\s*/, ""), items: [] };
      } else {
        if (!current) current = { title: "", items: [] };
        current.items.push(trimmed);
      }
    }
    if (current) sections.push(current);

    if (sections.length === 1 && !sections[0].title) {
      return sections[0].items.map(l => `<div class="term-item">– ${esc(l)}</div>`).join("");
    }

    return sections.map(s => `
      ${s.title ? `<div class="terms-section-title">${esc(s.title)}</div>` : ""}
      ${s.items.map(l => `<div class="term-item">– ${esc(l)}</div>`).join("")}
    `).join("");
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
      padding: 32px 48px 28px;
      display: flex;
      align-items: center;
      position: relative;
    }

    .header-accent {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 10px;
      background: #8B9A7B;
    }

    .header-logo {
      flex-shrink: 0;
      margin-left: 0;
    }

    .header-logo img {
      width: 90px;
      height: 90px;
      object-fit: contain;
    }

    .logo-placeholder {
      width: 90px;
      height: 90px;
      background: rgba(255,255,255,0.25);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-placeholder svg {
      width: 45px;
      height: 45px;
      opacity: 0.5;
    }

    .header-info {
      flex: 1;
      text-align: center;
      padding: 0 20px;
    }

    .header-info h1 {
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #1a1a1a;
      margin-bottom: 2px;
    }

    .header-subtitle {
      font-size: 13px;
      color: #555;
      font-weight: 500;
    }

    .header-factory {
      font-size: 10.5px;
      color: #777;
      margin-top: 3px;
    }

    /* ===== INFO TABLE ===== */
    .info-section {
      padding: 0 48px;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      border: 1px solid #ddd;
    }

    .info-table td {
      padding: 10px 20px;
      border: 1px solid #ddd;
      font-size: 13px;
      vertical-align: top;
    }

    .info-label {
      width: 110px;
      font-weight: 700;
      color: #1a1a1a;
      background: #fafaf8;
      text-align: right;
    }

    .info-value {
      color: #333;
    }

    .info-value .name-val {
      font-weight: 700;
      font-size: 13.5px;
    }

    .info-value .sub-line {
      font-size: 12px;
      color: #666;
      margin-top: 1px;
    }

    /* ===== SUBJECT ===== */
    .subject {
      padding: 22px 48px 0;
      text-align: center;
      margin-bottom: 6px;
    }

    .subject h2 {
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 5px;
    }

    .subject p {
      font-size: 12px;
      color: #555;
      line-height: 1.7;
    }

    /* ===== SECTION HEADER BAR ===== */
    .section-bar {
      background: #3d3d3d;
      color: #fff;
      padding: 12px 48px;
      font-size: 16px;
      font-weight: 800;
      margin-top: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      direction: rtl;
    }

    .section-bar-text {
      flex: 1;
      text-align: right;
    }

    .section-bar-icon {
      flex-shrink: 0;
    }

    .section-bar-icon svg {
      width: 22px;
      height: 22px;
      opacity: 0.6;
      fill: #fff;
    }

    /* ===== ITEMS TABLE ===== */
    .items-section {
      padding: 0 48px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      border: 1px solid #ddd;
    }

    .items-table thead th {
      background: #f5f5f3;
      color: #555;
      font-size: 12px;
      font-weight: 700;
      padding: 9px 12px;
      text-align: right;
      border: 1px solid #ddd;
    }

    .td-cell {
      padding: 9px 12px;
      border: 1px solid #eee;
      font-size: 13px;
    }

    .td-center { text-align: center; }
    .td-num { font-family: 'Cairo', monospace; text-align: left; direction: ltr; }
    .td-bold { font-weight: 700; }

    .td-desc {
      font-weight: 500;
    }

    /* ===== TOTALS (inside items table) ===== */
    .totals-row td {
      padding: 9px 12px;
      border: 1px solid #eee;
      font-size: 13px;
    }

    .totals-row .t-label {
      text-align: right;
      font-weight: 700;
      color: #333;
    }

    .totals-row .t-value {
      text-align: left;
      font-weight: 700;
      font-family: 'Cairo', monospace;
      direction: ltr;
      text-decoration: underline;
    }

    .grand-total-row td {
      background: #3d3d3d;
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      padding: 11px 12px;
      border: 1px solid #3d3d3d;
    }

    .grand-total-row .t-value {
      text-align: left;
      font-weight: 900;
      font-family: 'Cairo', monospace;
      direction: ltr;
      text-decoration: underline;
      color: #fff;
    }

    .advance-row td {
      padding: 9px 12px;
      border: 1px solid #eee;
      font-size: 13px;
      color: #16a34a;
    }

    .advance-row .t-label { text-align: right; font-weight: 700; }
    .advance-row .t-value { text-align: left; font-weight: 700; font-family: 'Cairo', monospace; direction: ltr; }

    /* ===== DISCLAIMER NOTE ===== */
    .disclaimer {
      text-align: center;
      font-size: 11px;
      color: #888;
      padding: 14px 48px 0;
      line-height: 1.7;
    }

    /* ===== PAGE FOOTER ===== */
    .page-footer {
      border-top: 1px solid #ddd;
      padding: 14px 48px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 11px;
      color: #999;
      margin-top: 30px;
      direction: ltr;
    }

    .footer-left {
      text-align: left;
      color: #aaa;
    }

    .footer-right {
      text-align: right;
      color: #999;
      line-height: 1.5;
    }

    /* ===== TERMS FOOTER ===== */
    .terms-footer {
      border-top: 1px solid #ddd;
      padding: 14px 48px;
      text-align: center;
      font-size: 11px;
      color: #999;
      margin-top: 30px;
    }

    /* ===== PAGE 2: TERMS ===== */
    .terms-page {
      page-break-before: always;
      padding: 0;
    }

    .terms-content {
      padding: 28px 48px 40px;
    }

    .terms-section-title {
      font-size: 14px;
      font-weight: 800;
      color: #1a1a1a;
      margin-top: 22px;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #1a1a1a;
      display: inline-block;
    }

    .terms-section-title:first-child {
      margin-top: 0;
    }

    .term-item {
      font-size: 13px;
      color: #444;
      padding: 3px 0;
      line-height: 1.8;
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
      <div class="header-accent"></div>
      <div class="header-logo">
        ${companyLogo
          ? `<img src="${companyLogo}" alt="${esc(companyName)}" />`
          : `<div class="logo-placeholder">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="35" height="35" rx="3" fill="#8B9A7B"/>
                <rect x="55" y="10" width="35" height="35" rx="3" fill="#C4A97D"/>
                <rect x="10" y="55" width="35" height="35" rx="3" fill="#C4A97D"/>
                <rect x="55" y="55" width="35" height="35" rx="3" fill="#8B9A7B"/>
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
            <div class="name-val">${esc(companyName)}</div>
            ${companyFactory ? `<div class="sub-line">${esc(companyFactory)}</div>` : ""}
            ${companyAddress ? `<div class="sub-line">${esc(companyAddress)}</div>` : ""}
            ${companyPhone ? `<div class="sub-line">${esc(companyPhone)}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td class="info-label">إلى العميل</td>
          <td class="info-value">
            <div class="name-val">${esc(quotation.customer.name)}</div>
            <div class="sub-line">${esc(quotation.customer.phoneCode)} ${esc(quotation.customer.phone)}</div>
            <div class="sub-line">${esc(quotation.customer.governorate)} – ${esc(quotation.customer.wilayat)}</div>
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
      <p>هذا العرض مقدّم بناءً على المواصفات والبنود المحددة أدناه، وفق المواصفات التالية.</p>
    </div>

    <!-- ========== ITEMS SECTION ========== -->
    <div class="section-bar">
      <span class="section-bar-text">تفاصيل البنود</span>
      <span class="section-bar-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><polyline points="10 9 9 9 8 9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </div>

    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:40px;text-align:center">م</th>
            <th>الوصف</th>
            <th style="width:80px;text-align:center">الكمية</th>
            <th style="width:115px;text-align:center">سعر الوحدة (ر.ع)</th>
            <th style="width:115px;text-align:center">الإجمالي (ر.ع)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <!-- Totals rows inside the table -->
          <tr class="totals-row">
            <td colspan="4" class="t-label">الإجمالي</td>
            <td class="t-value">${fmtCur(quotation.subtotal)}</td>
          </tr>
          <tr class="totals-row">
            <td colspan="4" class="t-label">ضريبة القيمة المضافة ${(quotation.vatRate * 100).toFixed(0)}%</td>
            <td class="t-value">${fmtCur(quotation.vatAmount)}</td>
          </tr>
          <tr class="grand-total-row">
            <td colspan="4" class="t-label" style="text-align:right;color:#fff">المبلغ الإجمالي</td>
            <td class="t-value">${fmtCur(quotation.total)}</td>
          </tr>
          ${quotation.advancePct > 0 ? `
          <tr class="advance-row">
            <td colspan="4" class="t-label">الدفعة المقدمة (${quotation.advancePct}%)</td>
            <td class="t-value">${fmtCur(quotation.advanceAmount)}</td>
          </tr>` : ""}
        </tbody>
      </table>
    </div>

    <!-- Disclaimer -->
    <div class="disclaimer">
      ${quotation.notes ? esc(quotation.notes) : "هذا السعر تقديري ويعتمد على المواصفات المدخلة – يُؤكَّد السعر النهائي بعد المعاينة الفعلية"}
    </div>

    <!-- ========== FOOTER (page 1) ========== -->
    <div class="page-footer">
      <div class="footer-left">${companyWebsite ? esc(companyWebsite) : ""}</div>
      <div class="footer-right">
        ${printDate}
      </div>
    </div>

    <!-- ========== PAGE 2: TERMS ========== -->
    ${termsConditions ? `
    <div class="terms-page">
      <div class="section-bar">
        <span class="section-bar-text">الشروط والمواصفات</span>
        <span class="section-bar-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><polyline points="10 9 9 9 8 9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
      <div class="terms-content">
        ${termsHtml}
      </div>

      <div class="terms-footer">
        ${esc(companyName)} · ${esc(companyFactory)} · ${esc(companyAddress)}
      </div>
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
