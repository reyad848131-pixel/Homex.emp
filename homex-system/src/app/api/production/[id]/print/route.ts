import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpecsCatalog } from "@/lib/foreman";
import { specRowsFromDetails } from "@/lib/specs-catalog";
import { parseItemDesc } from "@/lib/item-desc";
import { applyQuoteLocation } from "@/lib/quote-location";

export const dynamic = "force-dynamic";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const COMP_AR: Record<string, string> = { not_arrived: "لم تصل", arrived: "وصلت", installed: "تم التركيب" };

// Printable job tickets — one card per item in the order, each with its specs,
// its trackable components (checkboxes), delivery date, signature lines and a
// QR the foreman scans in-app to open the live item page.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const q = await prisma.quotation.findFirst({
      where: { id },
      select: {
        quoteNumber: true, deliveryDate: true, governorate: true, wilayat: true,
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, description: true, quantity: true, details: true,
            category: { select: { nameAr: true } },
            components: { orderBy: { createdAt: "asc" }, select: { name: true, status: true } },
          },
        },
      },
    });
    if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
    applyQuoteLocation(q as Parameters<typeof applyQuoteLocation>[0]);

    const catalog = await getSpecsCatalog();
    const place = [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ");
    const tel = q.customer ? `${q.customer.phoneCode}${q.customer.phone}` : "";
    const due = q.deliveryDate ? new Date(q.deliveryDate).toLocaleDateString("en-GB") : "—";

    const cards = await Promise.all(q.items.map(async (it) => {
      const qr = await QRCode.toDataURL(`item:${it.id}`, { margin: 1, width: 150 }).catch(() => "");
      const d = parseItemDesc(it.description);
      const descHtml = `<div class="title">${esc(d.title)} <span class="qty">×${it.quantity}</span></div>`
        + d.accessories.map((a) => `<div class="acc"><b>${esc(a.label)}:</b> ${a.values.map((v) => `<span class="chip">${esc(v)}</span>`).join(" ")}</div>`).join("")
        + (d.others.length ? `<div class="others">${d.others.map((o) => `<span class="chip g">${esc(o)}</span>`).join(" ")}</div>` : "");
      const specs = specRowsFromDetails(it.details, catalog);
      const specsHtml = specs.length
        ? specs.map((s) => `<div class="spec"><span class="k">${esc(s.labelAr)}</span><span class="v">${esc(s.value)}</span></div>`).join("")
        : `<div class="muted">لا مواصفات</div>`;
      const compsHtml = it.components.length
        ? it.components.map((c) => `<div class="comp"><span class="box"></span>${esc(c.name)} <span class="cs">(${COMP_AR[c.status] || c.status})</span></div>`).join("")
        : `<div class="muted">لا عناصر</div>`;
      return `
      <div class="card">
        <div class="head">
          <div>
            ${descHtml}
            <div class="cat">${esc(it.category.nameAr)}</div>
          </div>
          ${qr ? `<img class="qr" src="${qr}" alt="QR"/>` : ""}
        </div>
        <div class="meta">
          <span><b>${esc(q.quoteNumber)}</b></span>
          <span>${esc(q.customer?.name)}</span>
          <span>${esc(place)}</span>
          <span class="en">${esc(tel)}</span>
          <span>التسليم: <b class="en">${due}</b></span>
        </div>
        <div class="sec-title">المواصفات</div>
        <div class="specs">${specsHtml}</div>
        <div class="sec-title">العناصر والإضافات</div>
        <div class="comps">${compsHtml}</div>
        <div class="stages">المرحلة: ______________ التوقيع: ____________ التاريخ: ________</div>
      </div>`;
    }));

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>بطاقات العمل — ${esc(q.quoteNumber)}</title>
    <style>
      *{box-sizing:border-box} body{font-family:'Segoe UI',Tahoma,sans-serif;margin:0;padding:12px;background:#f3f4f6;color:#111}
      .en{font-family:ui-monospace,monospace;direction:ltr;unicode-bidi:embed}
      .bar{display:flex;gap:8px;justify-content:center;margin-bottom:12px}
      .bar button{padding:8px 18px;border:0;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px}
      .print{background:#0d9488;color:#fff} .close{background:#e5e7eb}
      .card{background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:14px;margin:0 auto 12px;max-width:720px;page-break-inside:avoid}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1px solid #eee;padding-bottom:8px}
      .title{font-size:18px;font-weight:800} .qty{color:#9ca3af;font-size:14px}
      .acc{font-size:12px;margin-top:3px} .acc b{color:#0d9488}
      .others{margin-top:3px}
      .chip{display:inline-block;background:#f0fdfa;color:#0f766e;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:bold;margin:1px}
      .chip.g{background:#f3f4f6;color:#6b7280}
      .cat{display:inline-block;background:#f3f4f6;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:bold;color:#6b7280;margin-top:4px}
      .qr{width:84px;height:84px;border:1px solid #e5e7eb;border-radius:8px}
      .meta{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:#374151;margin:8px 0}
      .sec-title{font-size:12px;font-weight:bold;color:#0d9488;margin:10px 0 4px}
      .specs{display:grid;grid-template-columns:1fr 1fr;gap:3px 18px}
      .spec{display:flex;justify-content:space-between;border-bottom:1px dotted #e5e7eb;font-size:13px;padding:2px 0}
      .spec .k{color:#6b7280} .spec .v{font-weight:bold}
      .comp{font-size:13px;padding:2px 0;display:flex;align-items:center;gap:6px}
      .box{display:inline-block;width:13px;height:13px;border:1.5px solid #9ca3af;border-radius:3px}
      .cs{color:#9ca3af;font-size:11px}
      .muted{color:#9ca3af;font-size:12px}
      .stages{margin-top:12px;border-top:1px dashed #d1d5db;padding-top:8px;font-size:12px;color:#6b7280}
      @media print{body{background:#fff;padding:0}.bar{display:none}.card{border-color:#999;margin:0 0 8px}}
    </style></head><body>
      <div class="bar">
        <button class="print" onclick="window.print()">🖨 طباعة</button>
        <button class="close" onclick="window.close()">إغلاق</button>
      </div>
      ${cards.join("")}
    </body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/production/[id]/print]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
