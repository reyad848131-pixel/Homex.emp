import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notifications";

const VALID_STATUSES = ["draft", "pending", "approved", "declined", "revised"];

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
        invoice: { include: { issuer: { select: { name: true } } } },
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
        const vatRate = body.vatRate ?? quotation.vatRate ?? 0.05;
        const vatAmount = Math.round(subtotal * vatRate * 1000) / 1000;
        const total = Math.round((subtotal + vatAmount) * 1000) / 1000;
        const advancePct = body.advancePct ?? quotation.advancePct ?? 15;
        const advanceAmount = Math.round(total * (advancePct / 100) * 1000) / 1000;

        if (body.customer && body.customerId) {
          await tx.customer.update({
            where: { id: body.customerId },
            data: {
              name: body.customer.name,
              phone: body.customer.phone,
              phoneCode: body.customer.phoneCode || "+968",
              governorate: body.customer.governorate,
              wilayat: body.customer.wilayat,
              ...(body.customer.address !== undefined ? { address: body.customer.address } : {}),
            },
          });
        }

        return tx.quotation.update({
          where: { id },
          data: {
            subtotal, vatRate, vatAmount, total, advancePct, advanceAmount,
            notes: body.notes,
            customerId: body.customerId,
            ...(body.deliveryDate !== undefined ? {
              deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
              ...(body.deliveryDate && !quotation.workStatus ? { workStatus: "needs_preparation" } : {}),
            } : {}),
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
    if (body.statusComment !== undefined) allowedFields.statusComment = body.statusComment;

    if (body.status === "revised") {
      allowedFields.status = "revised";
      if (body.statusComment) allowedFields.statusComment = body.statusComment;
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: allowedFields,
      include: { customer: true, items: { include: { category: true } } },
    });

    if (body.status) {
      await logAction(user.id, "status_change", "quotation", id, JSON.stringify({ to: body.status, comment: body.statusComment || null }));

      const statusLabels: Record<string, string> = {
        pending: "قيد المراجعة",
        approved: "معتمد",
        declined: "مرفوض",
        revised: "مُعاد للتعديل",
      };
      const label = statusLabels[body.status] || body.status;
      const link = `/quotations/${id}`;

      if (body.status === "pending") {
        await notifyAdmins("عرض سعر جديد للمراجعة", `${user.name} أرسل عرض سعر ${updated.quoteNumber} للمراجعة`, "info", link);
      } else if (body.status === "approved") {
        const comment = body.statusComment ? ` — "${body.statusComment}"` : "";
        await notify(updated.employeeId, "عرض السعر معتمد", `تم اعتماد عرض السعر ${updated.quoteNumber}${comment}`, "success", link);
      } else if (body.status === "declined") {
        const comment = body.statusComment ? ` — "${body.statusComment}"` : "";
        await notify(updated.employeeId, "عرض السعر مرفوض", `تم رفض عرض السعر ${updated.quoteNumber}${comment}`, "error", link);
      } else if (body.status === "revised") {
        const comment = body.statusComment ? ` — "${body.statusComment}"` : "";
        await notify(updated.employeeId, "عرض السعر مُعاد للتعديل", `تم إعادة عرض السعر ${updated.quoteNumber} لك للتعديل${comment}`, "warning", link);
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
