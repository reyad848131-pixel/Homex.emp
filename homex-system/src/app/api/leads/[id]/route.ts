import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUSES = ["new", "contacted", "converted", "archived"];

// Update a lead's status, or convert it into a real Customer.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };

    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Convert to a customer, then mark the lead converted.
    if (body.action === "convert") {
      if (lead.convertedCustomerId) {
        return NextResponse.json({ error: "تم تحويله مسبقاً", customerId: lead.convertedCustomerId }, { status: 409 });
      }
      const customer = await prisma.customer.create({
        data: {
          name: lead.name,
          phone: lead.phone || "-",
          governorate: lead.governorate || "-",
          wilayat: lead.wilayat || "-",
          address: lead.message || null,
          createdBy: user.id,
        },
        select: { id: true },
      });
      await prisma.lead.update({
        where: { id },
        data: { status: "converted", convertedCustomerId: customer.id, handledBy: user.id },
      });
      return NextResponse.json({ ok: true, customerId: customer.id });
    }

    // Otherwise a plain status change.
    const status = typeof body.status === "string" ? body.status : "";
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
    }
    await prisma.lead.update({ where: { id }, data: { status, handledBy: user.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
