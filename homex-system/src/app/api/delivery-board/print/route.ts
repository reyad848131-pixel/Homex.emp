import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { roundMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const STATUS_AR: Record<string, string> = { booked: "محجوز", contacted: "تم التواصل للحجز", delivered: "تم التوصيل", notified: "تم إبلاغه" };

// Print-friendly monthly delivery table (A4 landscape). Opens in a new tab with
// a Print / Save-PDF button — the customer-style branded look, Word-style grid.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const m = /^(\d{4})-(\d{2})$/.exec(searchParams.get("month") || "");
    const now = new Date();
    const year = m ? parseInt(m[1], 10) : now.getFullYear();
    const mon = m ? parseInt(m[2], 10) - 1 : now.getMonth();
    const start = new Date(year, mon, 1);
    const end = new Date(year, mon + 1, 1);
    const daysInMonth = new Date(year, mon + 1, 0).getDate();

    const rows = await prisma.quotation.findMany({
      where: { onDeliveryBoard: true, deliveryDate: { gte: start, lt: end } },
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
        payments: { select: { amount: true } },
      },
      orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
      take: 500,
    });

    const s = await getSettings();
    const companyName = s.company_name || "Homex";
    const companyLogo = s.company_logo || "";
    const monthLabel = new Date(year, mon, 1).toLocaleDateString("ar", { month: "long", year: "numeric" });

    const byDay: Record<number, typeof rows> = {};
    for (const q of rows) { const d = new Date(q.deliveryDate as Date); (byDay[d.getDate()] ||= [] as any).push(q); }

    let body = "";
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, mon, day);
      const weekday = d.toLocaleDateString("ar", { weekday: "long" });
      const list = byDay[day] || [];
      const weekendCls = weekday.includes("جمعة") ? ' class="we"' : "";
      if (list.length === 0) {
        body += `<tr${weekendCls}><td class="wd">${weekday}</td><td class="dt">${day}/${mon + 1}</td><td colspan="7"></td></tr>`;
        continue;
      }
      list.forEach((q, i) => {
        const paid = roundMoney((q.payments || []).reduce((sum, p) => sum + p.amount, 0));
        const remaining = roundMoney(Math.max(q.total - paid, 0));
        const payLabel = q.total > 0 && paid >= q.total - 0.0005 ? "مدفوع" : paid > 0 ? "جزئي" : "غير مدفوع";
        const region = q.deliveryLocation || [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ");
        body += `<tr${weekendCls}>`;
        if (i === 0) body += `<td class="wd" rowspan="${list.length}">${esc(weekday)}</td><td class="dt" rowspan="${list.length}">${day}/${mon + 1}</td>`;
        body += `<td class="cust">${esc(q.customer?.name)}<span>${esc(q.quoteNumber)}${q.deliveryTime ? " · " + esc(q.deliveryTime) : ""}</span></td>`;
        body += `<td>${esc(region)}</td><td class="num">${q.total.toFixed(3)}</td><td class="num">${remaining.toFixed(3)}</td>`;
        body += `<td>${payLabel}</td><td>${q.deliveryStatus ? esc(STATUS_AR[q.deliveryStatus] || q.deliveryStatus) : ""}</td><td>${esc(q.workNotes)}</td></tr>`;
      });
    }

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>توصيلات ${esc(monthLabel)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Montserrat:wght@700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Cairo',sans-serif;color:#262625;background:#eceae4;font-size:12px}
.bar{position:sticky;top:0;display:flex;gap:10px;align-items:center;justify-content:space-between;background:#3d3d3d;padding:9px 16px}
.bar a,.bar button{font-family:inherit;font-weight:700;font-size:13px;border-radius:8px;padding:8px 14px;border:none;cursor:pointer;text-decoration:none}
.bar .bk{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
.bar .sv{background:#fff;color:#3d3d3d}
.page{max-width:1100px;margin:16px auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.1);padding:22px}
.head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #8b9a7b;padding-bottom:12px;margin-bottom:14px}
.head img{width:54px;height:54px;object-fit:contain}
.head h1{font-family:'Montserrat',sans-serif;letter-spacing:6px;font-size:20px;color:#3d3d3d}
.head .mo{margin-inline-start:auto;font-size:16px;font-weight:800;color:#6f7e62}
table{width:100%;border-collapse:collapse}
th{background:#3d3d3d;color:#fff;font-size:11px;padding:7px 6px;text-align:center}
td{border:1px solid #e2e2dd;padding:5px 6px;text-align:center;vertical-align:middle}
td.wd{font-weight:700;color:#4a4a46;background:#f6f6f3;width:78px}
td.dt{font-weight:700;color:#6f7e62;width:52px}
td.cust{text-align:right;font-weight:700}
td.cust span{display:block;font-size:9.5px;color:#9c9d94;font-weight:400}
td.num{direction:ltr;font-variant-numeric:tabular-nums}
tr.we td{background:#faf6f2}
.foot{margin-top:12px;text-align:center;font-size:10px;color:#9c9d94}
@media print{body{background:#fff}.bar{display:none}.page{margin:0;max-width:100%;box-shadow:none;padding:0}@page{size:A4 landscape;margin:8mm}}
</style></head>
<body>
<div class="bar"><a class="bk" href="/delivery-board">→ رجوع</a><button class="sv" onclick="window.print()">⎙ طباعة / حفظ PDF</button></div>
<div class="page">
  <div class="head">${companyLogo ? `<img src="${companyLogo}" alt="">` : ""}<h1>${esc(companyName).toUpperCase()}</h1><span class="mo">جدول التوصيلات — ${esc(monthLabel)}</span></div>
  <table>
    <thead><tr><th>اليوم</th><th>التاريخ</th><th>العميل</th><th>المنطقة</th><th>المبلغ</th><th>المتبقّي</th><th>الدفع</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="foot">${esc(companyName)} · ${rows.length} توصيلة</div>
</div>
</body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("API error [/api/delivery-board/print]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
