import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { CURTAIN_WORK_STATUSES } from "@/lib/curtain-orders";

// Upsert the curtain-order tracking row for a quotation (id = quotation id).
// Only the fields the subcontractor workflow needs live here; the customer,
// dates and phone stay on the quotation.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.advanceBillNo !== undefined) data.advanceBillNo = String(body.advanceBillNo || "").trim() || null;
    if (body.manufacturer !== undefined) data.manufacturer = String(body.manufacturer || "").trim() || null;

    if (body.ourPrice !== undefined) {
      if (body.ourPrice === null || body.ourPrice === "") data.ourPrice = null;
      else {
        const n = Number(body.ourPrice);
        if (!isFinite(n) || n < 0) return NextResponse.json({ error: "سعر غير صالح" }, { status: 400 });
        data.ourPrice = n;
      }
    }
    if (body.outsidePrice !== undefined) {
      const n = Number(body.outsidePrice);
      if (!isFinite(n) || n < 0) return NextResponse.json({ error: "سعر غير صالح" }, { status: 400 });
      data.outsidePrice = n;
    }
    if (body.workStatus !== undefined) {
      const st = String(body.workStatus || "");
      if (!(CURTAIN_WORK_STATUSES as readonly string[]).includes(st)) return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
      data.workStatus = st;
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "لا يوجد تغيير" }, { status: 400 });

    await prisma.curtainOrder.upsert({
      where: { quotationId: id },
      create: { quotationId: id, ...data },
      update: data,
    });
    await logAction(user.id, "curtain_order_edit", "quotation", id, JSON.stringify(body)).catch(() => {});
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("API error [/api/curtain-orders/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
