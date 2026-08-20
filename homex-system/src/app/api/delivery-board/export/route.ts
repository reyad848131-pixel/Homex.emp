import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { boardEditorId, canAccessBoard } from "@/lib/delivery-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = { booked: "محجوز", contacted: "تم التواصل للحجز", delivered: "تم التوصيل", notified: "تم إبلاغه" };

// Monthly delivery board exported as an Excel sheet (one row per delivery).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    if (!canAccessBoard(user.role, user.id, await boardEditorId())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const m = /^(\d{4})-(\d{2})$/.exec(searchParams.get("month") || "");
    const now = new Date();
    const year = m ? parseInt(m[1], 10) : now.getFullYear();
    const mon = m ? parseInt(m[2], 10) - 1 : now.getMonth();
    const start = new Date(year, mon, 1);
    const end = new Date(year, mon + 1, 1);

    const rows = await prisma.quotation.findMany({
      where: { onDeliveryBoard: true, deliveryDate: { gte: start, lt: end } },
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
        payments: { select: { amount: true } },
      },
      orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
      take: 500,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("التوصيلات", { views: [{ rightToLeft: true }] });
    ws.columns = [
      { header: "اليوم", key: "day", width: 12 },
      { header: "التاريخ", key: "date", width: 12 },
      { header: "العميل", key: "customer", width: 22 },
      { header: "المنطقة", key: "region", width: 18 },
      { header: "رقم الكوتيشن", key: "number", width: 16 },
      { header: "الهاتف", key: "phone", width: 16 },
      { header: "الوقت", key: "time", width: 10 },
      { header: "المبلغ", key: "total", width: 12 },
      { header: "المدفوع", key: "paid", width: 12 },
      { header: "المتبقّي", key: "remaining", width: 12 },
      { header: "الدفع", key: "pay", width: 12 },
      { header: "الحالة", key: "status", width: 16 },
      { header: "ملاحظات", key: "notes", width: 28 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3D3D3D" } };

    for (const q of rows) {
      const d = q.deliveryDate ? new Date(q.deliveryDate) : null;
      const paid = roundMoney((q.payments || []).reduce((s, p) => s + p.amount, 0));
      const remaining = roundMoney(Math.max(q.total - paid, 0));
      const payLabel = q.total > 0 && paid >= q.total - 0.0005 ? "مدفوع" : paid > 0 ? "مدفوع جزئياً" : "غير مدفوع";
      ws.addRow({
        day: d ? d.toLocaleDateString("ar", { weekday: "long" }) : "",
        date: d ? `${d.getDate()}/${d.getMonth() + 1}` : "",
        customer: q.customer?.name || "",
        region: q.deliveryLocation || [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – "),
        number: q.quoteNumber,
        phone: `${q.customer?.phoneCode || ""} ${q.customer?.phone || ""}`.trim(),
        time: q.deliveryTime || "",
        total: q.total,
        paid,
        remaining,
        pay: payLabel,
        status: q.deliveryStatus ? (STATUS_AR[q.deliveryStatus] || q.deliveryStatus) : "",
        notes: q.workNotes || "",
      });
    }
    ws.eachRow((row) => row.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } }; }));

    const buf = await wb.xlsx.writeBuffer();
    const name = `delivery-${year}-${String(mon + 1).padStart(2, "0")}.xlsx`;
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("API error [/api/delivery-board/export]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
