import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notifications";

const VALID_STATUSES = ["draft", "pending", "approved", "declined"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        employee: { select: { id: true, name: true, civilId: true } },
        items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
        payments: { include: { recorder: { select: { name: true } } }, orderBy: { paidAt: "desc" } },
      },
    });

    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(quotation);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;
    const body = await req.json();

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (user.role === "sales" && ["approved", "declined"].includes(body.status)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    if (body.items) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.quoteItem.deleteMany({ where: { quotationId: id } });

        const subtotal = body.items.reduce((sum: number, item: any) => sum + (Number(item.lineTotal) || 0), 0);
        const vatRate = body.vatRate ?? 0.05;
        const vatAmount = subtotal * vatRate;
        const total = subtotal + vatAmount;
        const advancePct = body.advancePct ?? 15;
        const advanceAmount = total * (advancePct / 100);

        return tx.quotation.update({
          where: { id },
          data: {
            subtotal, vatRate, vatAmount, total, advancePct, advanceAmount,
            notes: body.notes,
            customerId: body.customerId,
            items: {
              create: body.items.map((item: any, idx: number) => ({
                categoryId: item.categoryId,
                description: item.description,
                details: item.details ? JSON.stringify(item.details) : null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                extras: item.extras || 0,
                lineTotal: item.lineTotal,
                sortOrder: idx,
              })),
            },
          },
          include: { customer: true, items: { include: { category: true } } },
        });
      });

      await logAction(user.id, "update", "quotation", id, "full_edit");
      return NextResponse.json(result);
    }

    const allowedFields: Record<string, any> = {};
    if (body.status) allowedFields.status = body.status;
    if (body.notes !== undefined) allowedFields.notes = body.notes;

    const updated = await prisma.quotation.update({
      where: { id },
      data: allowedFields,
      include: { customer: true, items: { include: { category: true } } },
    });

    if (body.status) {
      await logAction(user.id, "status_change", "quotation", id, JSON.stringify({ to: body.status }));

      const statusLabels: Record<string, string> = {
        pending: "قيد المراجعة",
        approved: "معتمد",
        declined: "مرفوض",
      };
      const label = statusLabels[body.status] || body.status;
      const link = `/quotations/${id}`;

      if (body.status === "pending") {
        await notifyAdmins("عرض سعر جديد للمراجعة", `${user.name} أرسل عرض سعر ${updated.quoteNumber} للمراجعة`, "info", link);
      } else if (body.status === "approved" || body.status === "declined") {
        await notify(updated.employeeId, `عرض السعر ${label}`, `تم ${label === "معتمد" ? "اعتماد" : "رفض"} عرض السعر ${updated.quoteNumber}`, body.status === "approved" ? "success" : "error", link);
      }
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await prisma.quotation.delete({ where: { id } });
    await logAction(user.id, "delete", "quotation", id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
