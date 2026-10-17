import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBrand, makeQr, esc } from "@/lib/pdf-brand";
import { applyQuoteLocation } from "@/lib/quote-location";

export const dynamic = "force-dynamic";

// The chevron fallback mark, used only when no company logo is set in settings.
const CHEVRON = (s1: string, s2: string) =>
  `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M7 34 L24 14 L41 34" fill="none" stroke="${s1}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 34 L24 24 L32 34" fill="none" stroke="${s2}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

// Printable project barcode — ONE shared QR for the whole quote (customer), not
// per item. It is printed as several identical copies (one per section) so a
// copy can be stuck on each physical piece; scanning any copy opens the project
// page with all sections in order. Card-sized (a touch bigger than a business
// card) so it fits on one small page, in the company's unified brand theme with
// the settings-driven watermark behind the identity block. Auto-opens print.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const q = await prisma.quotation.findFirst({
      where: { id },
      select: {
        id: true, quoteNumber: true, deliveryDate: true, governorate: true, wilayat: true,
        customer: { select: { name: true, governorate: true, wilayat: true } },
        items: { orderBy: { sortOrder: "asc" }, select: { category: { select: { nameAr: true } } } },
      },
    });
    if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
    applyQuoteLocation(q as Parameters<typeof applyQuoteLocation>[0]);

    const b = await loadBrand();
    const qr = await makeQr(`quote:${q.id}`);
    const cust = q.customer?.name || "";
    const loc = [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" — ");
    const d = q.deliveryDate ? new Date(q.deliveryDate) : null;
    const due = d ? `${String(d.getDate()).padStart(2, "0")} / ${String(d.getMonth() + 1).padStart(2, "0")}` : "—";

    // The sections, in order — listed on every (identical) copy so the foreman
    // knows this project has them before picking one on the scanned page.
    const sections = q.items.map((it) => it.category.nameAr);
    const uniqueSections = Array.from(new Set(sections));
    const sectionsLine = uniqueSections.join(" · ") || "—";
    // One identical copy per section, so a label can go on each piece.
    const copies = Math.max(1, q.items.length);

    const badge = b.companyLogo
      ? `<img src="${b.companyLogo}" alt="${esc(b.companyName)}" />`
      : CHEVRON("#fff", "#8b9a7b");
    // Watermark exactly like the PDF: the settings watermark image at the
    // settings opacity, else the brand monogram in the settings colour.
    const wm = !b.wmEnabled ? "" : b.wmImage
      ? `<div class="idwm"><img src="${b.wmImage}" alt="" style="opacity:${b.wmOpacity}"/></div>`
      : `<div class="idwm"><span style="color:${b.wmColor};opacity:${b.wmOpacity}">${b.monogram}</span></div>`;

    const card = `
      <div class="label">
        <div class="lh">
          <div class="lh-inner">
            <div class="lh-badge">${badge}</div>
            <h1>${esc(b.companyName).toUpperCase()}</h1>
            <div class="lh-sub">${esc(b.companySubtitle)}</div>
            <span class="lh-tag">بطاقة عمل · JOB CARD</span>
          </div>
        </div>
        <div class="body">
          <div class="idblock">
            ${wm}
            <div class="cust">${esc(cust)}</div>
            <div class="qnum num">${esc(q.quoteNumber)}</div>
            ${loc ? `<div class="loc">${esc(loc)}</div>` : ""}
          </div>
          ${qr ? `<img class="qr" src="${qr}" alt="QR"/>` : ""}
          <div class="foot">
            <span>الأقسام: <b class="cat">${esc(sectionsLine)}</b></span>
            <span class="due">التسليم: <b class="num">${due}</b></span>
          </div>
        </div>
      </div>`;

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>بطاقة المشروع — ${esc(q.quoteNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Montserrat:wght@600;700;800&display=swap');
  :root{
    --font-body:'Cairo','Segoe UI',Tahoma,sans-serif;
    --font-word:'Montserrat','Segoe UI',sans-serif;
    --ink:#262625; --muted:#7e7f77; --green:#3d3d3d; --green-2:#2a2a28;
    --sage:#8b9a7b; --sage-d:#6f7e62; --soft:#eef0ea; --paper:#fff; --line:#d3d4cc;
  }
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--font-body);background:#eceae4;color:var(--ink);
       display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px 14px;line-height:1.5;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .num{font-variant-numeric:tabular-nums;letter-spacing:.3px;direction:ltr;unicode-bidi:embed}
  .bar{display:flex;gap:8px}
  .bar button{padding:9px 20px;border:0;border-radius:9px;font-weight:bold;cursor:pointer;font-size:14px;font-family:var(--font-body)}
  .bar .print{background:var(--sage-d);color:#fff} .bar .close{background:#dcdcd4;color:#333}

  /* Card: a touch bigger than a business card, sized to fit one small page. */
  .label{width:82mm;background:var(--paper);border:1px solid var(--line);
         box-shadow:0 10px 36px rgba(0,0,0,.12);overflow:hidden;text-align:center}
  .lh{background:linear-gradient(135deg,var(--green) 0%,var(--green-2) 100%);color:#fff;
      padding:14px 16px 12px;position:relative;overflow:hidden}
  /* Plain strong header — the green radial glow was removed; keep the subtle
     sage underline from the brand theme only. */
  .lh::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;
             background:linear-gradient(90deg,transparent,var(--sage),transparent)}
  .lh-inner{position:relative}
  .lh-badge{width:40px;height:40px;margin:0 auto 8px;border:1px solid rgba(255,255,255,.35);border-radius:10px;
            display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.07);overflow:hidden}
  .lh-badge img{width:100%;height:100%;object-fit:contain}
  .lh-badge svg{width:24px;height:24px}
  .lh h1{font-family:var(--font-word);font-size:19px;font-weight:700;letter-spacing:6px;line-height:1;padding-inline-start:6px}
  .lh-sub{font-size:8.5px;color:rgba(255,255,255,.78);margin-top:5px;font-weight:500;letter-spacing:.4px}
  .lh-tag{display:inline-block;margin-top:8px;font-size:8px;letter-spacing:2px;text-transform:uppercase;
          color:rgba(255,255,255,.72);border:1px solid rgba(255,255,255,.28);border-radius:20px;padding:2px 10px}

  .body{padding:16px 16px 14px}
  .idblock{position:relative;padding:6px 0 2px;overflow:hidden}
  .idwm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
  .idwm img{width:120px;height:120px;object-fit:contain}
  .idwm span{font-size:96px;font-weight:900;line-height:1}
  .idblock>*:not(.idwm){position:relative;z-index:1}
  .cust{font-size:19px;font-weight:800;color:var(--ink);line-height:1.2}
  .qnum{display:inline-block;margin-top:8px;font-size:13px;font-weight:800;color:var(--sage-d);
        background:var(--soft);border:1px solid #cdd6c2;border-radius:8px;padding:3px 12px}
  .loc{font-size:12px;color:var(--muted);font-weight:600;margin-top:6px}

  .qr{width:34mm;height:34mm;margin:12px auto 0;border:1px solid var(--line);border-radius:10px;padding:7px;background:#fff;display:block}

  .foot{margin-top:12px;padding-top:9px;border-top:1px solid var(--line);
        display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:var(--muted)}
  .foot .cat{font-size:12px;font-weight:800;color:var(--sage-d)}
  .foot .due b{color:var(--ink);font-weight:800}

  @page{ size:90mm 132mm; margin:4mm }
  @media print{
    body{background:#fff;padding:0;gap:0} .bar{display:none}
    .label{border:none;box-shadow:none;width:100%;break-after:page;page-break-after:always}
    .label:last-child{break-after:auto;page-break-after:auto}
  }
</style></head><body>
  <div class="bar">
    <button class="print" onclick="window.print()">🖨 طباعة (${copies} نسخة)</button>
    <button class="close" onclick="window.close()">إغلاق</button>
  </div>
  ${Array.from({ length: copies }).map(() => card).join("")}
  <script>window.addEventListener("load", function(){ setTimeout(function(){ try{ window.print(); }catch(e){} }, 350); });</script>
</body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/quote/[id]/label]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
