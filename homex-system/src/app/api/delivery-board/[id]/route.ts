import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { boardEditorId, canEditBoard, DELIVERY_STATUSES } from "@/lib/delivery-board";

// Edit a delivery-board entry. Only the designated board editor (or an owner)
// may write. Changes go straight onto the quotation — the delivery date/time,
// location and notes are the real fields, so they sync to the schedule, the
// work board and every other view. Adding / removing from the board and the
// board-specific delivery status live here too.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    const { id } = await params;

    const editorId = await boardEditorId();
    if (!canEditBoard(user.role, user.id, editorId)) {
      return NextResponse.json({ error: "غير مصرّح — تعديل لوحة التوصيلات للمالك والمحرّر المحدّد فقط", code: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body.onDeliveryBoard === "boolean") data.onDeliveryBoard = body.onDeliveryBoard;

    if (body.deliveryDate !== undefined) {
      if (body.deliveryDate === null || body.deliveryDate === "") {
        data.deliveryDate = null;
        data.deliveryTime = null;
      } else {
        const d = new Date(body.deliveryDate);
        if (isNaN(d.getTime())) return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
        data.deliveryDate = d;
        data.deliveryDateEstimated = false;
      }
    }
    if (body.deliveryTime !== undefined) data.deliveryTime = body.deliveryTime || null;
    if (body.deliveryDays !== undefined) data.deliveryDays = Math.max(1, Math.min(14, parseInt(String(body.deliveryDays), 10) || 1));
    if (body.deliveryLocation !== undefined) data.deliveryLocation = body.deliveryLocation || null;
    if (body.workNotes !== undefined) data.workNotes = body.workNotes || null;
    if (body.deliveryStatus !== undefined) {
      const st = String(body.deliveryStatus || "");
      if (!(DELIVERY_STATUSES as readonly string[]).includes(st)) return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
      data.deliveryStatus = st || null;
      // Mirror a completed delivery onto the shared workflow so other screens agree.
      if (st === "delivered") data.deliveredAt = new Date();
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "لا يوجد تغيير" }, { status: 400 });

    const updated = await prisma.quotation.update({ where: { id }, data });
    await logAction(user.id, "delivery_board_edit", "quotation", id, JSON.stringify(body)).catch(() => {});
    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e) {
    console.error("API error [/api/delivery-board/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
