import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBrand, makeQr, esc } from "@/lib/pdf-brand";
import { applyQuoteLocation } from "@/lib/quote-location";

export const dynamic = "force-dynamic";

// The chevron fallback mark, used only when no company logo is set in settings.
const CHEVRON = (stroke1: string, stroke2: string) =>
  `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M7 34 L24 14 L41 34" fill="none" stroke="${stroke1}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 34 L24 24 L32 34" fill="none" stroke="${stroke2}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

// Printable barcode / job label for a single item — the approved design: the
// company's unified brand theme (Iridium + sage, Cairo + Montserrat), everything
// centred, with the company watermark faintly behind the customer name / quote
// number / location block, exactly like the quotation documents. Auto-opens the
// print dialog. Meant to be printed small (A5 or a sticker) and taped to the
// cabinet / kitchen so anyone can scan it to open the live item page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const item = await prisma.quoteItem.findFirst({
      where: { id },
      select: {
        id: true,
        category: { select: { nameAr: true } },
        quotation: {
          select: {
            quoteNumber: true, deliveryDate: true, governorate: true, wilayat: true,
            customer: { select: { name: true, governorate: true, wilayat: true } },
          },
        },
      },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    applyQuoteLocation(item.quotation as Parameters<typeof applyQuoteLocation>[0]);

    const b = await loadBrand();
    const qr = await makeQr(`item:${item.id}`);
    const cust = item.quotation.customer?.name || "";
    const loc = [item.quotation.customer?.governorate, item.quotation.customer?.wilayat].filter(Boolean).join(" — ");
    const d = item.quotation.deliveryDate ? new Date(item.quotation.deliveryDate) : null;
    const due = d ? `${String(d.getDate()).padStart(2, "0")} / ${String(d.getMonth() + 1).padStart(2, "0")}` : "—";

    // Real logo image if the company set one, else the chevron fallback.
    const badge = b.companyLogo
      ? `<img src="${b.companyLogo}" alt="${esc(b.companyName)}" />`
      : CHEVRON("#fff", "#8b9a7b");
    const watermark = b.companyLogo
      ? `<img src="${b.companyLogo}" alt="" />`
      : CHEVRON("#3d3d3d", "#3d3d3d");

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>بطاقة العمل — ${esc(item.quotation.quoteNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Montserrat:wght@600;700;800&display=swap');
  :root{
    --font-body:'Cairo','Segoe UI',Tahoma,sans-serif;
    --font-word:'Montserrat','Segoe UI',sans-serif;
    --ink:#262625; --muted:#7e7f77; --green:#3d3d3d; --green-2:#2a2a28;
    --sage:#8b9a7b; --sage-d:#6f7e62; --soft:#eef0ea; --paper:#fff; --line:#d3d4cc;
  }
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--font-body);background:#eceae4;color:var(--ink);min-height:100vh;
       display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px 16px;line-height:1.6;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .num{font-variant-numeric:tabular-nums;letter-spacing:.3px;direction:ltr;unicode-bidi:embed}
  .bar{display:flex;gap:8px}
  .bar button{padding:9px 20px;border:0;border-radius:9px;font-weight:bold;cursor:pointer;font-size:14px;font-family:var(--font-body)}
  .bar .print{background:var(--sage-d);color:#fff} .bar .close{background:#dcdcd4;color:#333}

  .label{width:360px;background:var(--paper);border:1px solid var(--line);
         box-shadow:0 10px 40px rgba(0,0,0,.12);overflow:hidden;text-align:center}
  .lh{background:linear-gradient(135deg,var(--green) 0%,var(--green-2) 100%);color:#fff;
      padding:22px 20px 20px;position:relative;overflow:hidden}
  .lh::before{content:"";position:absolute;top:-40%;right:-10%;width:180px;height:180px;border-radius:50%;
              background:radial-gradient(circle,rgba(139,154,123,.22),transparent 70%);pointer-events:none}
  .lh::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;
             background:linear-gradient(90deg,transparent,var(--sage),transparent)}
  .lh-inner{position:relative}
  .lh-badge{width:48px;height:48px;margin:0 auto 11px;border:1px solid rgba(255,255,255,.35);border-radius:12px;
            display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.07);overflow:hidden;
            box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .lh-badge img{width:100%;height:100%;object-fit:contain}
  .lh-badge svg{width:28px;height:28px}
  .lh h1{font-family:var(--font-word);font-size:23px;font-weight:700;letter-spacing:8px;line-height:1;padding-inline-start:8px}
  .lh-sub{font-size:9.5px;color:rgba(255,255,255,.78);margin-top:7px;font-weight:500;letter-spacing:.5px}
  .lh-tag{display:inline-block;margin-top:10px;font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;
          color:rgba(255,255,255,.72);border:1px solid rgba(255,255,255,.28);border-radius:20px;padding:3px 12px}

  .body{padding:24px 20px}
  .idblock{position:relative;padding:10px 0 4px;overflow:hidden}
  .idwm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        opacity:.07;pointer-events:none;z-index:0}
  .idwm svg,.idwm img{width:150px;height:150px;object-fit:contain}
  .idblock>*:not(.idwm){position:relative;z-index:1}
  .cust{font-size:23px;font-weight:800;color:var(--ink);line-height:1.2}
  .qnum{display:inline-block;margin-top:10px;font-size:14px;font-weight:800;color:var(--sage-d);
        background:var(--soft);border:1px solid #cdd6c2;border-radius:8px;padding:4px 14px}
  .loc{font-size:13px;color:var(--muted);font-weight:600;margin-top:8px}

  .qr{width:180px;height:180px;margin:18px auto 0;border:1px solid var(--line);border-radius:12px;padding:10px;background:#fff;display:block}

  .foot{margin-top:16px;padding-top:12px;border-top:1px solid var(--line);
        display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted)}
  .foot .cat{font-size:14px;font-weight:800;color:var(--sage-d)}
  .foot .due b{color:var(--ink);font-weight:800}

  @media print{
    body{background:#fff;padding:0;gap:0} .bar{display:none}
    .label{border:none;box-shadow:none;width:100%}
  }
</style></head><body>
  <div class="bar">
    <button class="print" onclick="window.print()">🖨 طباعة</button>
    <button class="close" onclick="window.close()">إغلاق</button>
  </div>

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
        <div class="idwm">${watermark}</div>
        <div class="cust">${esc(cust)}</div>
        <div class="qnum num">${esc(item.quotation.quoteNumber)}</div>
        ${loc ? `<div class="loc">${esc(loc)}</div>` : ""}
      </div>
      ${qr ? `<img class="qr" src="${qr}" alt="QR"/>` : ""}
      <div class="foot">
        <span>الصنف: <b class="cat">${esc(item.category.nameAr)}</b></span>
        <span class="due">التسليم: <b class="num">${due}</b></span>
      </div>
    </div>
  </div>

  <script>window.addEventListener("load", function(){ setTimeout(function(){ try{ window.print(); }catch(e){} }, 350); });</script>
</body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/item/[id]/label]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
