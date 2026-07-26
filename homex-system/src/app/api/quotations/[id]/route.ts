import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notifications";
import { computeQuoteTotals } from "@/lib/quote-calc";
import { parseBody, updateQuotationItemsSchema } from "@/lib/schemas";
import { roundMoney } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { isFinanciallyLocked, newTotalBelowPaid, canSetStatus } from "@/lib/quote-rules";

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
  } catch (e) {
    console.error("API error [/api/quotations/[id]]:", e);
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

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { invoice: { select: { id: true } }, _count: { select: { payments: true } } },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isManager = (user.role === "admin" || user.role === "ceo") || user.role === "manager";
    const locked = isFinanciallyLocked(quotation);

    // A quotation is financially frozen once it is invoiced, has payments, or
    // the customer accepted it. Sales can never touch a locked quote; a
    // manager/admin may override it (e.g. the customer requested a change) but
    // must supply a justification, and the new total can't drop below what the
    // customer already paid.
    if (body.items && locked) {
      if (!isManager) {
        return NextResponse.json(
          { error: "لا يمكن تعديل بنود عرض معتمد أو مفوتر أو له دفعات", code: "locked" },
          { status: 409 }
        );
      }
      if (!body.editReason || !String(body.editReason).trim()) {
        return NextResponse.json({ error: "سبب التعديل مطلوب لتعديل عرض مفوتر", code: "reason_required" }, { status: 400 });
      }
      const paidAgg = await prisma.payment.aggregate({ where: { quotationId: id }, _sum: { amount: true } });
      const paid = roundMoney(paidAgg._sum.amount || 0);
      const newTotals = computeQuoteTotals(
        body.items,
        body.vatRate ?? quotation.vatRate ?? 0.05,
        body.advancePct ?? quotation.advancePct ?? 15
      );
      if (newTotalBelowPaid(newTotals.total, paid)) {
        return NextResponse.json(
          { error: `الإجمالي الجديد (${roundMoney(newTotals.total).toFixed(3)}) أقل من المبلغ المدفوع (${paid.toFixed(3)})`, code: "below_paid" },
          { status: 400 }
        );
      }
    }

    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const selfApprove = (await getSetting("allow_self_approve", "false")) === "true";
      const decision = canSetStatus({ role: user.role, status: body.status, selfApprove });
      if (!decision.ok) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    if (body.items) {
      const parsed = parseBody(updateQuotationItemsSchema, body);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });

      const result = await prisma.$transaction(async (tx) => {
        await tx.quoteItem.deleteMany({ where: { quotationId: id } });

        // Recompute every monetary field server-side — never trust client totals.
        const totals = computeQuoteTotals(
          body.items,
          body.vatRate ?? quotation.vatRate ?? 0.05,
          body.advancePct ?? quotation.advancePct ?? 15
        );

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
            subtotal: totals.subtotal,
            vatRate: totals.vatRate,
            vatAmount: totals.vatAmount,
            total: totals.total,
            advancePct: totals.advancePct,
            advanceAmount: totals.advanceAmount,
            notes: body.notes,
            customerId: body.customerId,
            ...(locked && isManager ? {
              managerEditNote: String(body.editReason).trim(),
              managerEditedAt: new Date(),
            } : {}),
            ...(body.deliveryDate !== undefined ? {
              deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
              deliveryTime: body.deliveryDate ? (body.deliveryTime || null) : null,
              ...(body.deliveryDate && !quotation.workStatus ? { workStatus: "needs_preparation" } : {}),
            } : {}),
            items: {
              create: totals.items.map((item) => ({
                categoryId: item.categoryId,
                description: item.description,
                details: item.details,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                extras: item.extras,
                lineTotal: item.lineTotal,
                sortOrder: item.sortOrder,
              })),
            },
          },
          include: { customer: true, items: { include: { category: true } } },
        });
      });

      if (locked && isManager) {
        await logAction(user.id, "manager_override_edit", "quotation", id, String(body.editReason).trim());
        // Tell the quote owner their (locked) quotation was changed by a manager.
        if (result.employeeId !== user.id) {
          await notify(
            result.employeeId,
            "تعديل على عرض مقفل",
            `عدّل ${user.name} عرض السعر ${result.quoteNumber} بعد الفوترة/الدفع — السبب: "${String(body.editReason).trim()}"`,
            "warning",
            `/quotations/${id}`
          ).catch(() => {});
        }
      } else {
        await logAction(user.id, "update", "quotation", id, "full_edit");
      }
      return NextResponse.json(result);
    }

    const allowedFields: Record<string, any> = {};
    if (body.status) allowedFields.status = body.status;
    // Re-arm the follow-up nudge whenever a quote is (re)sent for review.
    if (body.status === "pending") allowedFields.followUpNotified = false;
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
  } catch (e) {
    console.error("API error [/api/quotations/[id]]:", e);
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

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { invoice: { select: { id: true } }, _count: { select: { payments: true } } },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    if (isFinanciallyLocked(quotation)) {
      return NextResponse.json(
        { error: "لا يمكن حذف عرض معتمد أو مفوتر أو له دفعات", code: "locked" },
        { status: 409 }
      );
    }

    await prisma.quotation.delete({ where: { id } });
    await logAction(user.id, "delete", "quotation", id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("API error [/api/quotations/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
