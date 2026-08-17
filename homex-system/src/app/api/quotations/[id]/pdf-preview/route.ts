import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { pdfToolbar } from "@/lib/pdf-shell";
import QRCode from "qrcode";

// ── PREVIEW ONLY ─────────────────────────────────────────────────────────────
// A redesigned, premium quotation document. Kept as a SEPARATE route so the
// live /pdf template is untouched. Once approved, this template replaces it.
// Palette: official Homex — Iridium dark + sage green accent + warm neutrals.

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
    const companyCR = s.company_cr || "";
    const termsConditions = s.terms_conditions || "";
    const companyLogo = s.company_logo || "";
    const companyWebsite = s.company_website || "";
    const companyInstagram = s.company_instagram || "";
    const companyMaps = s.company_maps || "";
    // Accept a bare Instagram handle or a full URL.
    const instaUrl = companyInstagram
      ? (/^https?:\/\//i.test(companyInstagram) ? companyInstagram : `https://instagram.com/${companyInstagram.replace(/^@/, "")}`)
      : "";

    const fmtCur = (n: number) => n.toFixed(3);
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });
    const now = new Date();
    const printDate = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;

    const qrGen = async (data: string) => {
      try { return await QRCode.toDataURL(data, { margin: 1, width: 220, color: { dark: "#3d3d3d", light: "#ffffff" } }); }
      catch { return ""; }
    };
    // QR → public quote link (view / e-sign), plus Instagram and factory location.
    const qrDataUrl = quotation.publicToken ? await qrGen(`${req.nextUrl.origin}/q/${quotation.publicToken}`) : "";
    const qrInsta = instaUrl ? await qrGen(instaUrl) : "";
    const qrMaps = companyMaps ? await qrGen(companyMaps) : "";

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

    const signed = !!quotation.signedAt;
    const signedDate = quotation.signedAt
      ? new Date(quotation.signedAt).toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" })
      : "";

    const monogram = (esc(companyName).trim()[0] || "H").toUpperCase();
    const iconLines = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#8b9a7b" stroke-width="2" stroke-linecap="round"><line x1="8" y1="7" x2="20" y2="7"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="17" x2="20" y2="17"/><circle cx="4" cy="7" r="1.4" fill="#8b9a7b" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="#8b9a7b" stroke="none"/><circle cx="4" cy="17" r="1.4" fill="#8b9a7b" stroke="none"/></svg>`;

    // Footer letterhead line, reused on both pages.
    const footerLine = [companyPhone, companyAddress, companyCR ? `س.ت ${companyCR}` : "", companyWebsite]
      .filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>عرض سعر - ${esc(quotation.quoteNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&family=Tajawal:wght@300;400;500;700;800&display=swap');

  :root {
    --font-body: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    --font-head: 'El Messiri', 'Tajawal', serif;
    /* Official Homex palette: warm neutral scale + sage green accent. */
    --ink: #262625;        /* brand near-black (gray-900) */
    --muted: #7e7f77;      /* brand gray-500 */
    --green: #3d3d3d;      /* Iridium — the ONE dark (bars/letterhead) */
    --green-2: #2a2a28;    /* darker Iridium for depth */
    --sage: #8b9a7b;       /* brand sage green — the accent */
    --sage-d: #6f7e62;     /* darker sage for text */
    --soft: #eef0ea;       /* faint Green White tint */
    --paper: #ffffff;
    --panel: #f6f6f3;      /* brand gray-50 */
    --line: #d3d4cc;       /* Pastel Grey hairline (gray-200) */
  }

  * , *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: var(--font-body);
    font-size: 13px; color: var(--ink); background: #eceae4; line-height: 1.65;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; letter-spacing: .2px; }

  .page {
    max-width: 820px; margin: 22px auto; background: var(--paper);
    box-shadow: 0 10px 40px rgba(0,0,0,.10); position: relative; overflow: hidden;
  }

  /* watermark — brand logo (faint), falls back to the monogram letter */
  .watermark {
    position: absolute; top: 320px; left: 50%; transform: translateX(-50%);
    font-size: 460px; font-weight: 900; color: #26262510; line-height: 1;
    z-index: 0; pointer-events: none; user-select: none;
  }
  .watermark img { width: 460px; height: 460px; object-fit: contain; opacity: 0.05; }
  .page > *:not(.watermark) { position: relative; z-index: 1; }

  /* ===== LETTERHEAD ===== */
  .lh { background: linear-gradient(135deg, var(--green) 0%, var(--green-2) 100%); color:#fff;
        padding: 32px 44px 28px; display:flex; align-items:center; gap:22px; position:relative; }
  .lh::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px;
               background: linear-gradient(90deg, var(--sage), transparent 60%); }
  .lh-badge { width:80px; height:80px; flex-shrink:0; border:1px solid rgba(255,255,255,.32); border-radius:12px;
              display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.06); overflow:hidden; }
  .lh-badge img { width:100%; height:100%; object-fit:contain; }
  .lh-badge .mono { font-size:38px; font-weight:800; color:#fff; letter-spacing:1px; }
  .lh-main { flex:1; }
  .lh-main h1 { font-family:var(--font-head); font-size:32px; font-weight:700; letter-spacing:8px; line-height:1.1; }
  .lh-sub { font-size:12px; color:rgba(255,255,255,.85); margin-top:7px; font-weight:500; letter-spacing:.3px; }
  .lh-factory { font-size:10.5px; color:rgba(255,255,255,.6); margin-top:3px; }
  .lh-doc { text-align:left; flex-shrink:0; }
  .lh-doc .k { font-size:10px; letter-spacing:2px; color:rgba(255,255,255,.6); text-transform:uppercase; }
  .lh-doc .v { font-size:18px; font-weight:800; letter-spacing:1px; margin-top:3px; }
  .lh-doc .badge { display:inline-block; margin-top:8px; font-size:10px; letter-spacing:1px; padding:3px 10px;
                   border:1px solid rgba(255,255,255,.3); border-radius:20px; color:rgba(255,255,255,.85); }

  /* ===== META ===== */
  .meta { display:flex; padding:26px 44px 8px; gap:34px; }
  .meta-col { flex:1; }
  .meta-col.right { border-inline-start:1px solid var(--line); padding-inline-start:34px; }
  .meta-k { font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; color:var(--sage-d); font-weight:700; margin-bottom:7px; }
  .meta-name { font-size:15px; font-weight:700; color:var(--ink); }
  .meta-line { font-size:12px; color:var(--muted); margin-top:2px; }

  .facts { display:flex; margin:22px 44px 0; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .fact { flex:1; padding:12px 16px; text-align:center; }
  .fact + .fact { border-inline-start:1px solid var(--line); }
  .fact .k { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }
  .fact .v { font-size:13px; font-weight:700; color:var(--ink); margin-top:3px; }
  .fact .v.accent { color:var(--sage-d); }

  /* ===== SECTION ===== */
  .sec { margin:30px 44px 0; display:flex; align-items:center; gap:10px; }
  .sec .bar { width:4px; height:18px; background:var(--sage); border-radius:2px; }
  .sec .ic { display:flex; }
  .sec h2 { font-family:var(--font-head); font-size:16px; font-weight:700; color:var(--green); letter-spacing:.3px; }
  .sec .rule { flex:1; height:1px; background:var(--line); }

  /* ===== ITEMS ===== */
  .items { width:calc(100% - 88px); margin:14px 44px 0; border-collapse:collapse; }
  .items thead th { background:var(--green); color:#fff; font-size:11.5px; font-weight:700; padding:11px 14px; text-align:right; letter-spacing:.3px; }
  .items thead th:first-child { border-start-start-radius:8px; }
  .items thead th:last-child { border-start-end-radius:8px; }
  .items tbody td { padding:11px 14px; font-size:13px; border-bottom:1px solid var(--line); vertical-align:top; }
  .items tbody tr:nth-child(even) td { background:var(--panel); }
  .c-idx { text-align:center; width:38px; color:var(--muted); }
  .c-desc { font-weight:500; }
  .c-qty { text-align:center; width:64px; }
  .c-num { text-align:left; width:120px; font-variant-numeric:tabular-nums; direction:ltr; }
  .c-strong { font-weight:800; color:var(--sage-d); }
  .items thead th.ta-c { text-align:center; }

  /* ===== TOTALS ===== */
  .totals { display:flex; justify-content:flex-start; margin:18px 44px 0; }
  .totals-card { width:340px; }
  .tt { display:flex; justify-content:space-between; padding:8px 16px; font-size:13px; }
  .tt .l { color:var(--muted); font-weight:600; }
  .tt .v { font-variant-numeric:tabular-nums; direction:ltr; font-weight:700; }
  .tt.sub { border-bottom:1px solid var(--line); }
  .tt.grand { background:var(--green); color:#fff; border-radius:10px; padding:13px 16px; margin-top:8px; }
  .tt.grand .l { color:#fff; font-weight:800; font-size:14px; }
  .tt.grand .v { color:#fff; font-weight:900; font-size:15px; }
  .tt.adv { background:var(--soft); border-radius:8px; margin-top:6px; }
  .tt.adv .l { color:var(--sage-d); font-weight:700; }
  .tt.adv .v { color:var(--sage-d); }

  .note { margin:22px 44px 0; padding:12px 16px; background:var(--panel); border-inline-start:3px solid var(--sage); border-radius:6px; font-size:11.5px; color:var(--muted); line-height:1.7; }

  /* ===== APPROVAL / SIGNATURE ===== */
  .approve { margin:26px 44px 0; display:flex; gap:22px; align-items:stretch; }
  .sign-cols { flex:1; display:flex; gap:22px; }
  .sign-box { flex:1; border:1px solid var(--line); border-radius:12px; padding:16px 18px; background:var(--panel); }
  .sign-box .t { font-size:11px; letter-spacing:1px; text-transform:uppercase; color:var(--sage-d); font-weight:700; }
  .sign-line { height:46px; border-bottom:1.5px dashed var(--line); margin:14px 0 8px; display:flex; align-items:flex-end; justify-content:center; }
  .sign-line img { max-height:60px; }
  .sign-meta { font-size:11px; color:var(--muted); display:flex; justify-content:space-between; }
  .stamp { width:96px; height:96px; border:2px dashed var(--line); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#b9bab1; font-size:10px; text-align:center; flex-shrink:0; align-self:center; }
  .qr-box { text-align:center; flex-shrink:0; width:120px; }
  .qr-box img { width:104px; height:104px; border:1px solid var(--line); border-radius:8px; padding:4px; background:#fff; }
  .qr-box .cap { font-size:10px; color:var(--muted); margin-top:6px; line-height:1.5; }

  /* footer */
  .foot { margin-top:26px; padding:14px 44px; border-top:1px solid var(--line); }
  .foot .row1 { text-align:center; font-size:10.5px; color:var(--muted); }
  .foot .row2 { display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:10.5px; color:var(--muted); }
  .foot .brand { font-family:var(--font-head); font-weight:700; color:var(--green); letter-spacing:1px; }
  /* footer QR strip (Instagram / location) */
  .foot-qr { display:flex; justify-content:center; gap:34px; margin-top:14px; padding-top:14px; border-top:1px dashed var(--line); }
  .fq { text-align:center; }
  .fq img { width:70px; height:70px; border:1px solid var(--line); border-radius:8px; padding:3px; background:#fff; }
  .fq .cap { font-size:9.5px; color:var(--muted); margin-top:5px; letter-spacing:.3px; }
  .fq .cap b { color:var(--sage-d); font-weight:700; }

  /* ===== TERMS PAGE ===== */
  .terms { padding:40px 44px; }
  .terms-title { font-family:var(--font-head); font-size:15px; font-weight:700; color:var(--green); margin:22px 0 8px; padding-bottom:5px; border-bottom:2px solid var(--sage); display:inline-block; }
  .terms-title:first-child { margin-top:0; }
  .term-item { font-size:13px; color:#3f3f3a; padding:4px 0; line-height:1.85; position:relative; padding-inline-start:16px; }
  .term-item::before { content:""; position:absolute; inset-inline-start:0; top:12px; width:5px; height:5px; border-radius:50%; background:var(--sage); }
  .terms-foot { margin-top:30px; padding-top:14px; border-top:1px solid var(--line); font-size:10.5px; color:var(--muted); text-align:center; }

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
  <div class="watermark">${companyLogo ? `<img src="${companyLogo}" alt="" />` : monogram}</div>

  <!-- LETTERHEAD -->
  <div class="lh">
    <div class="lh-badge">${companyLogo ? `<img src="${companyLogo}" alt="${esc(companyName)}" />` : `<span class="mono">${monogram}</span>`}</div>
    <div class="lh-main">
      <h1>${esc(companyName).toUpperCase()}</h1>
      <div class="lh-sub">${esc(companySubtitle)}</div>
      <div class="lh-factory">${esc(companyFactory)}</div>
    </div>
    <div class="lh-doc">
      <div class="k">عرض سعر</div>
      <div class="v num">${esc(quotation.quoteNumber)}</div>
      ${signed ? `<div class="badge">موقّع ✓</div>` : ``}
    </div>
  </div>

  <!-- META -->
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

  <!-- TOTALS -->
  <div class="totals"><div class="totals-card">
    <div class="tt sub"><span class="l">الإجمالي الفرعي</span><span class="v">${fmtCur(quotation.subtotal)} <span style="color:var(--muted);font-weight:600">ر.ع</span></span></div>
    <div class="tt"><span class="l">ضريبة القيمة المضافة ${(quotation.vatRate * 100).toFixed(0)}%</span><span class="v">${fmtCur(quotation.vatAmount)}</span></div>
    <div class="tt grand"><span class="l">المبلغ الإجمالي</span><span class="v">${fmtCur(quotation.total)} ر.ع</span></div>
    ${quotation.advancePct > 0 ? `<div class="tt adv"><span class="l">الدفعة المقدمة (${quotation.advancePct}%)</span><span class="v">${fmtCur(quotation.advanceAmount)} ر.ع</span></div>` : ""}
  </div></div>

  <!-- NOTE -->
  <div class="note">${quotation.notes ? esc(quotation.notes) : "هذا السعر تقديري ويعتمد على المواصفات المدخلة — يُؤكَّد السعر النهائي بعد المعاينة الفعلية."}</div>

  <!-- APPROVAL + SIGNATURE + STAMP + QR -->
  <div class="approve">
    <div class="sign-cols">
      <div class="sign-box">
        <div class="t">توقيع العميل</div>
        <div class="sign-line">${signed && quotation.signatureData ? `<img src="${quotation.signatureData}" alt="signature" />` : ``}</div>
        <div class="sign-meta"><span>${signed ? esc(quotation.signerName || "") : "الاسم"}</span><span>${signed ? esc(signedDate) : "التاريخ"}</span></div>
      </div>
      <div class="sign-box">
        <div class="t">عن الشركة</div>
        <div class="sign-line"></div>
        <div class="sign-meta"><span>الختم والتوقيع</span><span></span></div>
      </div>
    </div>
    ${qrDataUrl
      ? `<div class="qr-box"><img src="${qrDataUrl}" alt="QR" /><div class="cap">امسح للاطّلاع على العرض<br/>والموافقة إلكترونياً</div></div>`
      : `<div class="stamp">ختم<br/>الشركة</div>`}
  </div>

  <!-- FOOTER -->
  <div class="foot">
    <div class="row1">${footerLine}</div>
    <div class="row2"><span class="brand">${esc(companyName)}</span><span class="num">${printDate}</span></div>
    ${(qrInsta || qrMaps) ? `<div class="foot-qr">
      ${qrInsta ? `<div class="fq"><img src="${qrInsta}" alt="Instagram" /><div class="cap"><b>إنستقرام</b><br/>${esc(companyInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, ""))}</div></div>` : ""}
      ${qrMaps ? `<div class="fq"><img src="${qrMaps}" alt="Location" /><div class="cap"><b>موقع المصنع</b><br/>امسح للوصول</div></div>` : ""}
    </div>` : ""}
  </div>

  <!-- TERMS PAGE -->
  ${(termsConditions || signed) ? `
  <div class="terms">
    <div class="sec" style="margin:0 0 6px"><span class="bar"></span><span class="ic">${iconLines}</span><h2>الشروط والمواصفات</h2><span class="rule"></span></div>
    <div style="margin-top:18px">${termsHtml}</div>
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
