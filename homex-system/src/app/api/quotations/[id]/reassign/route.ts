import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Move a quotation to a DIFFERENT customer — either an existing one or a new
// one created on the spot. Used to fix orders that were linked to the wrong
// customer at import time (a phone matched a pre-existing customer with another
// name), without touching that shared customer's other orders.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const isManager = user.role === "admin" || user.role === "ceo" || user.role === "manager";
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const quotation = await prisma.quotation.findFirst({ where: { id }, select: { id: true, customerId: true, customer: { select: { name: true } } } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    let targetId: string | null = null;
    let targetName = "";

    if (body.customerId) {
      // Move to an existing customer.
      const cust = await prisma.customer.findFirst({ where: { id: String(body.customerId) }, select: { id: true, name: true } });
      if (!cust) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
      targetId = cust.id;
      targetName = cust.name;
    } else if (body.newCustomer) {
      // Create a new customer and move to it.
      const n = body.newCustomer;
      const name = String(n.name || "").trim();
      const phone = String(n.phone || "").replace(/\s+/g, "");
      if (!name) return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
      const created = await prisma.customer.create({
        data: {
          name,
          phone: phone || "-",
          phoneCode: String(n.phoneCode || "+968"),
          governorate: String(n.governorate || "-") || "-",
          wilayat: String(n.wilayat || "-") || "-",
          address: n.address ? String(n.address) : null,
          createdBy: user.id,
        },
        select: { id: true, name: true },
      });
      targetId = created.id;
      targetName = created.name;
    } else {
      return NextResponse.json({ error: "لا يوجد عميل هدف" }, { status: 400 });
    }

    if (targetId === quotation.customerId) {
      return NextResponse.json({ error: "الطلب مرتبط بهذا العميل بالفعل" }, { status: 400 });
    }

    await prisma.quotation.update({ where: { id }, data: { customerId: targetId } });
    await logAction(
      user.id, "reassign", "quotation", id,
      JSON.stringify({ from: quotation.customer?.name, to: targetName, toId: targetId })
    );

    return NextResponse.json({ ok: true, customerId: targetId, name: targetName });
  } catch (e) {
    console.error("API error [/api/quotations/[id]/reassign]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
