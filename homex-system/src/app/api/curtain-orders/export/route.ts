import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { curtainCountFromDesc } from "@/lib/order-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = {
  placed: "تم الطلب", awaiting: "بإنتظار التصنيع", manufacturing: "قيد التصنيع",
  completed: "مكتمل", ready: "جاهز للتوصيل", delivered: "تم التوصيل",
};

type Row = {
  name: string; date: Date | null; phone: string; place: string; bill: string;
  our: number; outside: number; diff: number; manufacturer: string; count: number; status: string;
};

// Export the curtain-order sheet as Excel (both linked + standalone rows).
export async function GET(_req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const quotes = await prisma.quotation.findMany({
      where: { status: { not: "declined" }, items: { some: { categoryId: "curtains" } } },
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
        items: { where: { categoryId: "curtains" }, select: { description: true, lineTotal: true } },
        curtainOrder: true,
      },
      take: 1000,
    });

    const rows: Row[] = quotes.map((q) => {
      const curtainTotal = roundMoney(q.items.reduce((s, it) => s + (it.lineTotal || 0), 0));
      const co = q.curtainOrder;
      const our = co?.ourPrice != null ? co.ourPrice : curtainTotal;
      const outside = co?.outsidePrice ?? 0;
      return {
        name: q.customer?.name || "",
        date: q.deliveryDate ? new Date(q.deliveryDate) : null,
        phone: q.customer?.phone ? `${q.customer.phoneCode || ""}${q.customer.phone}` : "",
        place: [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ") || q.deliveryLocation || "",
        bill: co?.advanceBillNo || "",
        our: roundMoney(our), outside: roundMoney(outside), diff: roundMoney(our - outside),
        manufacturer: co?.manufacturer || "",
        count: q.items.reduce((s, it) => s + curtainCountFromDesc(it.description), 0),
        status: co?.workStatus || "placed",
      };
    });

    const standaloneRows = await prisma.curtainOrder.findMany({ where: { quotationId: null }, take: 1000 });
    for (const co of standaloneRows) {
      const our = co.ourPrice ?? 0, outside = co.outsidePrice ?? 0;
      rows.push({
        name: co.custName || "", date: co.deliveryDate ? new Date(co.deliveryDate) : null,
        phone: co.custPhone ? `${co.custPhoneCode || ""}${co.custPhone}` : "",
        place: co.place || "", bill: co.advanceBillNo || "",
        our: roundMoney(our), outside: roundMoney(outside), diff: roundMoney(our - outside),
        manufacturer: co.manufacturer || "", count: co.curtainCount ?? 0, status: co.workStatus || "placed",
      });
    }

    rows.sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return -1; if (b.date) return 1; return 0;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("طلبات الستائر", { views: [{ rightToLeft: true }] });
    ws.columns = [
      { header: "م", key: "no", width: 6 },
      { header: "الاسم", key: "name", width: 24 },
      { header: "تاريخ التوصيل", key: "date", width: 14 },
      { header: "الهاتف", key: "phone", width: 16 },
      { header: "المكان", key: "place", width: 16 },
      { header: "عدد الستائر", key: "count", width: 10 },
      { header: "رقم السند", key: "bill", width: 12 },
      { header: "سعرنا", key: "our", width: 12 },
      { header: "سعر المورّد", key: "outside", width: 12 },
      { header: "الفارق", key: "diff", width: 12 },
      { header: "المصنّع", key: "manufacturer", width: 20 },
      { header: "حالة العمل", key: "status", width: 16 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6F7E62" } };

    let totalOur = 0, totalOut = 0, totalDiff = 0, totalCount = 0;
    rows.forEach((r, i) => {
      ws.addRow({
        no: i + 1, name: r.name, date: r.date ? r.date.toLocaleDateString("en-GB") : "",
        phone: r.phone, place: r.place, count: r.count || "", bill: r.bill,
        our: r.our || 0, outside: r.outside || 0, diff: r.diff || 0,
        manufacturer: r.manufacturer, status: STATUS_AR[r.status] || r.status,
      });
      totalOur += r.our; totalOut += r.outside; totalDiff += r.diff; totalCount += r.count;
    });

    const totalRow = ws.addRow({ name: "الإجمالي", count: totalCount, our: roundMoney(totalOur), outside: roundMoney(totalOut), diff: roundMoney(totalDiff) });
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    ["our", "outside", "diff"].forEach((k) => { ws.getColumn(k).numFmt = "0.000"; });

    const buf = await wb.xlsx.writeBuffer();
    const fname = `curtain-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    console.error("API error [/api/curtain-orders/export]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
