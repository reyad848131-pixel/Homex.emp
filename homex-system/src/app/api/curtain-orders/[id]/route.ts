import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { CURTAIN_WORK_STATUSES } from "@/lib/curtain-orders";
import { normalizeCredential } from "@/lib/text";

// Edit a curtain-order row. `id` is either a QUOTATION id (linked row — the
// tracking fields are upserted onto its CurtainOrder) or a standalone
// CurtainOrder id (external / imported row — updated directly, including its own
// customer fields). We tell them apart by looking the quotation up first.

const num = (v: unknown): number | null => {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Fields common to both kinds.
    const common: Record<string, unknown> = {};
    if (body.advanceBillNo !== undefined) common.advanceBillNo = String(body.advanceBillNo || "").trim() || null;
    if (body.manufacturer !== undefined) common.manufacturer = String(body.manufacturer || "").trim() || null;
    if (body.ourPrice !== undefined) {
      if (body.ourPrice === null || body.ourPrice === "") common.ourPrice = null;
      else { const n = num(body.ourPrice); if (n === null) return NextResponse.json({ error: "سعر غير صالح" }, { status: 400 }); common.ourPrice = n; }
    }
    if (body.outsidePrice !== undefined) { const n = num(body.outsidePrice); common.outsidePrice = n ?? 0; }
    if (body.workStatus !== undefined) {
      const st = String(body.workStatus || "");
      if (!(CURTAIN_WORK_STATUSES as readonly string[]).includes(st)) return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
      common.workStatus = st;
    }

    const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true, customerId: true } });

    if (quotation) {
      // LINKED row. Curtain-tracking fields + a count override live on the
      // CurtainOrder; customer/quotation fields are written back to the ORIGINAL
      // records so everything stays a single source of truth.
      const coData: Record<string, unknown> = { ...common };
      if (body.curtainCount !== undefined) { const n = num(body.curtainCount); coData.curtainCount = n === null ? null : Math.round(n); }
      if (Object.keys(coData).length > 0) {
        await prisma.curtainOrder.upsert({ where: { quotationId: id }, create: { quotationId: id, ...coData }, update: coData });
      }

      // Customer identity (shared across the customer's orders).
      const custData: Record<string, unknown> = {};
      if (body.customerName !== undefined && String(body.customerName).trim()) custData.name = String(body.customerName).trim();
      if (body.phone !== undefined) { const p = normalizeCredential(String(body.phone || "")); custData.phone = p; if (p) custData.phoneCode = "+968"; }
      if (Object.keys(custData).length > 0 && quotation.customerId) {
        await prisma.customer.update({ where: { id: quotation.customerId }, data: custData });
      }

      // Quotation fields: delivery date + the place (stored as deliveryLocation).
      const qData: Record<string, unknown> = {};
      if (body.deliveryDate !== undefined) {
        if (!body.deliveryDate) qData.deliveryDate = null;
        else { const d = new Date(body.deliveryDate); if (isNaN(d.getTime())) return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 }); qData.deliveryDate = d; }
      }
      if (body.region !== undefined) qData.deliveryLocation = String(body.region || "").trim() || null;
      if (Object.keys(qData).length > 0) {
        await prisma.quotation.update({ where: { id }, data: qData });
      }
    } else {
      // STANDALONE row — update by its own id, including its customer fields.
      const existing = await prisma.curtainOrder.findUnique({ where: { id }, select: { id: true, quotationId: true } });
      if (!existing || existing.quotationId) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const data = { ...common };
      if (body.customerName !== undefined) data.custName = String(body.customerName || "").trim() || null;
      if (body.phone !== undefined) data.custPhone = normalizeCredential(String(body.phone || "")) || null;
      if (body.phoneCode !== undefined) data.custPhoneCode = String(body.phoneCode || "").trim() || null;
      if (body.region !== undefined) data.place = String(body.region || "").trim() || null;
      if (body.curtainCount !== undefined) { const n = num(body.curtainCount); data.curtainCount = n === null ? null : Math.round(n); }
      if (body.deliveryDate !== undefined) {
        if (!body.deliveryDate) data.deliveryDate = null;
        else { const d = new Date(body.deliveryDate); if (isNaN(d.getTime())) return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 }); data.deliveryDate = d; }
      }
      if (Object.keys(data).length === 0) return NextResponse.json({ error: "لا يوجد تغيير" }, { status: 400 });
      await prisma.curtainOrder.update({ where: { id }, data });
    }

    await logAction(user.id, "curtain_order_edit", "curtain_order", id, JSON.stringify(body)).catch(() => {});
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("API error [/api/curtain-orders/[id]] PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Delete a STANDALONE row only. A linked row is removed by deleting/declining its
// quotation, not from here.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string };
    const { id } = await params;
    const existing = await prisma.curtainOrder.findUnique({ where: { id }, select: { id: true, quotationId: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.quotationId) return NextResponse.json({ error: "طلب مرتبط بكوتيشن — يُحذف من الكوتيشن", code: "linked" }, { status: 400 });
    await prisma.curtainOrder.delete({ where: { id } });
    await logAction(user.id, "curtain_order_delete", "curtain_order", id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/curtain-orders/[id]] DELETE:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
