import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { pdfToolbar } from "@/lib/pdf-shell";

// ── PREVIEW ONLY ─────────────────────────────────────────────────────────────
// A redesigned, premium quotation document. Kept as a SEPARATE route so the
// live /pdf template is untouched. Once approved, this template replaces it.
// One locked palette: deep brand green + warm gold accent + warm neutrals.

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
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
    const companySubtitle = s.company_subtitle || "مطابخ · خزائن · أثاث مخصص وتصميم داخلي";
    const companyFactory = s.company_factory || "شركة تابعة لمصنع سلطان النبهاني للمنتجات الخشبية — بهلاء، عُمان";
    const termsConditions = s.terms_conditions || "";
    const companyLogo = s.company_logo || "";
    const companyWebsite = s.company_website || "";

    const fmtCur = (n: number) => n.toFixed(3);
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });
    const now = new Date();
    const printDate = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;

    const itemRows = quotation.items.map((item, i) => `
      <tr>
        <td class="c-idx">${i + 1}</td>
        <td class="c-desc">${esc(item.description)}</td>
        <td class="c-qty">${item.quantity}</td>
        <td class="c-num">${fmtCur(item.unitPrice)}</td>
        <td class="c-num c-strong">${fmtCur(item.lineTotal)}</td>
      </tr>`).join("");

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
        return sections[0].items.map((l) => `<div class="term-item">${esc(l)}</div>`).join("");
      }
      return sections.map((sec) => `
        ${sec.title ? `<div class="terms-title">${esc(sec.title)}</div>` : ""}
        ${sec.items.map((l) => `<div class="term-item">${esc(l)}</div>`).join("")}
      `).join("");
    })() : "";

    const signedDate = quotation.signedAt
      ? new Date(quotation.signedAt).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const signatureHtml = quotation.signedAt ? `
      <div class="sign-block">
        <div class="sign-title">توقيع العميل على العقد</div>
        <div class="sign-row">
          <div><span class="sign-label">الاسم</span> ${esc(quotation.signerName || "")}</div>
          <div><span class="sign-label">التاريخ</span> ${esc(signedDate)}</div>
        </div>
        ${quotation.signatureData ? `<img class="sign-img" src="${quotation.signatureData}" alt="signature" />` : ""}
      </div>` : "";

    const monogram = (esc(companyName).trim()[0] || "H").toUpperCase();

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>عرض سعر - ${esc(quotation.quoteNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');

  :root {
    /* Official Homex palette: warm neutral scale + sage green accent. */
    --ink: #262625;        /* brand near-black (gray-900) */
    --muted: #7e7f77;      /* brand gray-500 */
    --green: #3d3d3d;      /* Iridium — the ONE dark (bars/letterhead) */
    --green-2: #2a2a28;    /* darker Iridium for depth */
    --soft: #eef0ea;       /* faint Green White tint */
    --gold: #8b9a7b;       /* brand sage green — the accent */
    --paper: #ffffff;
    --panel: #f6f6f3;      /* brand gray-50 */
    --line: #d3d4cc;       /* Pastel Grey hairline (gray-200) */
  }

  * , *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    font-size: 13px;
    color: var(--ink);
    background: #eceae4;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; letter-spacing: .2px; }

  .page {
    max-width: 820px;
    margin: 22px auto;
    background: var(--paper);
    box-shadow: 0 10px 40px rgba(0,0,0,.10);
  }

  /* ===== LETTERHEAD ===== */
  .lh {
    background: linear-gradient(135deg, var(--green) 0%, var(--green-2) 100%);
    color: #fff;
    padding: 30px 44px 26px;
    display: flex;
    align-items: center;
    gap: 22px;
    position: relative;
  }
  .lh::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background: var(--gold); }
  .lh-badge {
    width: 74px; height: 74px; flex-shrink:0;
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 10px;
    display:flex; align-items:center; justify-content:center;
    background: rgba(255,255,255,.06);
    overflow:hidden;
  }
  .lh-badge img { width:100%; height:100%; object-fit:contain; }
  .lh-badge .mono { font-size:34px; font-weight:800; color:#fff; letter-spacing:1px; }
  .lh-main { flex:1; }
  .lh-main h1 { font-size: 30px; font-weight: 800; letter-spacing: 7px; line-height:1.1; }
  .lh-sub { font-size: 12px; color: rgba(255,255,255,.82); margin-top: 6px; font-weight:500; letter-spacing:.3px; }
  .lh-factory { font-size: 10.5px; color: rgba(255,255,255,.6); margin-top: 3px; }
  .lh-doc { text-align:left; flex-shrink:0; }
  .lh-doc .k { font-size:10px; letter-spacing:2px; color:rgba(255,255,255,.6); text-transform:uppercase; }
  .lh-doc .v { font-size:17px; font-weight:800; letter-spacing:1px; margin-top:2px; }

  /* ===== META ROW ===== */
  .meta { display:flex; padding: 26px 44px 8px; gap: 34px; }
  .meta-col { flex:1; }
  .meta-col.right { border-inline-start: 1px solid var(--line); padding-inline-start: 34px; }
  .meta-k { font-size: 10.5px; letter-spacing:1.5px; text-transform:uppercase; color: var(--gold); font-weight:700; margin-bottom: 7px; }
  .meta-name { font-size: 15px; font-weight: 700; color: var(--ink); }
  .meta-line { font-size: 12px; color: var(--muted); margin-top: 2px; }

  /* facts strip */
  .facts { display:flex; gap:0; margin: 22px 44px 0; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .fact { flex:1; padding: 12px 16px; text-align:center; }
  .fact + .fact { border-inline-start:1px solid var(--line); }
  .fact .k { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }
  .fact .v { font-size:13px; font-weight:700; color:var(--ink); margin-top:3px; }
  .fact .v.accent { color: #6f7e62; }

  /* ===== SECTION TITLE ===== */
  .sec { margin: 30px 44px 0; display:flex; align-items:center; gap:12px; }
  .sec .bar { width:4px; height:18px; background:var(--gold); border-radius:2px; }
  .sec h2 { font-size: 15px; font-weight: 800; color: var(--green); letter-spacing:.3px; }
  .sec .rule { flex:1; height:1px; background: var(--line); }

  /* ===== ITEMS ===== */
  .items { width: calc(100% - 88px); margin: 14px 44px 0; border-collapse: collapse; }
  .items thead th {
    background: var(--green); color:#fff; font-size:11.5px; font-weight:700;
    padding: 11px 14px; text-align: right; letter-spacing:.3px;
  }
  .items thead th:first-child { border-start-start-radius:8px; }
  .items thead th:last-child { border-start-end-radius:8px; }
  .items tbody td { padding: 11px 14px; font-size:13px; border-bottom:1px solid var(--line); vertical-align:top; }
  .items tbody tr:nth-child(even) td { background: var(--panel); }
  .c-idx { text-align:center; width:38px; color:var(--muted); }
  .c-desc { font-weight:500; }
  .c-qty { text-align:center; width:64px; }
  .c-num { text-align:left; width:120px; font-variant-numeric: tabular-nums; direction:ltr; }
  .c-strong { font-weight:800; color:#6f7e62; }
  .items thead th.ta-c { text-align:center; }

  /* ===== TOTALS ===== */
  .totals { display:flex; justify-content:flex-start; margin: 18px 44px 0; }
  .totals-card { width: 340px; }
  .tt { display:flex; justify-content:space-between; padding: 8px 16px; font-size:13px; }
  .tt .l { color: var(--muted); font-weight:600; }
  .tt .v { font-variant-numeric: tabular-nums; direction:ltr; font-weight:700; }
  .tt.sub { border-bottom:1px solid var(--line); }
  .tt.grand { background: var(--green); color:#fff; border-radius:10px; padding:13px 16px; margin-top:8px; }
  .tt.grand .l { color:#fff; font-weight:800; font-size:14px; }
  .tt.grand .v { color:#fff; font-weight:900; font-size:15px; }
  .tt.adv { background: var(--soft); border-radius:8px; margin-top:6px; }
  .tt.adv .l { color: #6f7e62; font-weight:700; }
  .tt.adv .v { color: #6f7e62; }

  /* note */
  .note { margin: 22px 44px 0; padding: 12px 16px; background: var(--panel); border-inline-start:3px solid var(--gold); border-radius:6px; font-size:11.5px; color:var(--muted); line-height:1.7; }

  /* footer */
  .foot { margin-top: 26px; padding: 16px 44px; border-top:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--muted); }
  .foot .brand { font-weight:800; color:var(--green); letter-spacing:1px; }

  /* ===== TERMS PAGE ===== */
  .terms { padding: 40px 44px; }
  .terms-title { font-size: 14px; font-weight: 800; color: var(--green); margin: 22px 0 8px; padding-bottom:5px; border-bottom: 2px solid var(--gold); display:inline-block; }
  .terms-title:first-child { margin-top:0; }
  .term-item { font-size:13px; color:#3f3f3a; padding: 4px 0 4px 0; line-height:1.85; position:relative; padding-inline-start:16px; }
  .term-item::before { content:""; position:absolute; inset-inline-start:0; top:12px; width:5px; height:5px; border-radius:50%; background:var(--gold); }
  .sign-block { margin-top: 34px; padding: 20px; border:1px solid var(--line); border-radius:12px; background:var(--panel); }
  .sign-title { font-size:13px; font-weight:800; color:var(--green); margin-bottom:12px; }
  .sign-row { display:flex; gap:40px; font-size:13px; }
  .sign-label { color:var(--muted); font-weight:700; margin-inline-end:6px; }
  .sign-img { display:block; margin-top:14px; max-height:110px; }
  .terms-foot { margin-top: 30px; padding-top:14px; border-top:1px solid var(--line); font-size:10.5px; color:var(--muted); text-align:center; }

  @media print {
    body { background:#fff; }
    .page { margin:0; max-width:100%; box-shadow:none; }
    .terms { page-break-before: always; }
  }
</style>
</head>
<body>
${pdfToolbar(`/quotations/${id}`)}
<div class="page">

  <!-- LETTERHEAD -->
  <div class="lh">
    <div class="lh-badge">
      ${companyLogo ? `<img src="${companyLogo}" alt="${esc(companyName)}" />` : `<span class="mono">${monogram}</span>`}
    </div>
    <div class="lh-main">
      <h1>${esc(companyName).toUpperCase()}</h1>
      <div class="lh-sub">${esc(companySubtitle)}</div>
      <div class="lh-factory">${esc(companyFactory)}</div>
    </div>
    <div class="lh-doc">
      <div class="k">عرض سعر</div>
      <div class="v num">${esc(quotation.quoteNumber)}</div>
    </div>
  </div>

  <!-- META: from / to -->
  <div class="meta">
    <div class="meta-col">
      <div class="meta-k">من</div>
      <div class="meta-name">${esc(companyName)}</div>
      ${companyAddress ? `<div class="meta-line">${esc(companyAddress)}</div>` : ""}
      ${companyPhone ? `<div class="meta-line num">${esc(companyPhone)}</div>` : ""}
    </div>
    <div class="meta-col right">
      <div class="meta-k">إلى العميل</div>
      <div class="meta-name">${esc(quotation.customer.name)}</div>
      <div class="meta-line num">${esc(quotation.customer.phoneCode)} ${esc(quotation.customer.phone)}</div>
      <div class="meta-line">${esc(quotation.customer.governorate)} – ${esc(quotation.customer.wilayat)}</div>
      ${quotation.customer.address ? `<div class="meta-line">${esc(quotation.customer.address)}</div>` : ""}
    </div>
  </div>

  <!-- FACTS -->
  <div class="facts">
    <div class="fact"><div class="k">التاريخ</div><div class="v">${fmtDate(quotation.createdAt)}</div></div>
    ${quotation.validUntil ? `<div class="fact"><div class="k">صالح حتى</div><div class="v">${fmtDate(quotation.validUntil)}</div></div>` : ""}
    ${quotation.deliveryDate ? `<div class="fact"><div class="k">موعد التسليم</div><div class="v accent">${fmtDate(quotation.deliveryDate)}</div></div>` : ""}
  </div>

  <!-- ITEMS -->
  <div class="sec"><span class="bar"></span><h2>تفاصيل البنود</h2><span class="rule"></span></div>
  <table class="items">
    <thead>
      <tr>
        <th class="ta-c" style="width:38px">م</th>
        <th>الوصف</th>
        <th class="ta-c" style="width:64px">الكمية</th>
        <th class="ta-c" style="width:120px">سعر الوحدة (ر.ع)</th>
        <th class="ta-c" style="width:120px">الإجمالي (ر.ع)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals">
    <div class="totals-card">
      <div class="tt sub"><span class="l">الإجمالي الفرعي</span><span class="v">${fmtCur(quotation.subtotal)} <span style="color:var(--muted);font-weight:600">ر.ع</span></span></div>
      <div class="tt"><span class="l">ضريبة القيمة المضافة ${(quotation.vatRate * 100).toFixed(0)}%</span><span class="v">${fmtCur(quotation.vatAmount)}</span></div>
      <div class="tt grand"><span class="l">المبلغ الإجمالي</span><span class="v">${fmtCur(quotation.total)} ر.ع</span></div>
      ${quotation.advancePct > 0 ? `<div class="tt adv"><span class="l">الدفعة المقدمة (${quotation.advancePct}%)</span><span class="v">${fmtCur(quotation.advanceAmount)} ر.ع</span></div>` : ""}
    </div>
  </div>

  <!-- NOTE -->
  <div class="note">${quotation.notes ? esc(quotation.notes) : "هذا السعر تقديري ويعتمد على المواصفات المدخلة — يُؤكَّد السعر النهائي بعد المعاينة الفعلية."}</div>

  <!-- FOOTER -->
  <div class="foot">
    <div>${companyWebsite ? esc(companyWebsite) : `<span class="brand">${esc(companyName)}</span>`}</div>
    <div class="num">${printDate}</div>
  </div>

  <!-- TERMS PAGE -->
  ${(termsConditions || quotation.signedAt) ? `
  <div class="terms">
    <div class="sec" style="margin:0 0 6px"><span class="bar"></span><h2>الشروط والمواصفات</h2><span class="rule"></span></div>
    <div style="margin-top:18px">
      ${termsHtml}
      ${signatureHtml}
    </div>
    <div class="terms-foot">${esc(companyName)} · ${esc(companyFactory)} · ${esc(companyAddress)}</div>
  </div>` : ""}

</div>
</body>
</html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/quotations/[id]/pdf-preview]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
