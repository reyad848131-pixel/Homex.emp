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
import { userCan } from "@/lib/permissions";
import { priceEditorIds, canEditPrice, hasPriceOverride } from "@/lib/price-permission";

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

    // Quotations expose prices — only roles with quote access may read one.
    const privileged = user.role === "admin" || user.role === "ceo" || user.role === "manager";
    if (!(privileged || (await userCan(user.role, "quotes")))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const quotation = await prisma.quotation.findFirst({
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

    const quotation = await prisma.quotation.findFirst({
      where: { id },
      include: { invoice: { select: { id: true } }, _count: { select: { payments: true } } },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isManager = (user.role === "admin" || user.role === "ceo") || user.role === "manager";
    const locked = isFinanciallyLocked(quotation);

    // Convert an approved quote into a confirmed contract: lock it (status
    // "accepted") and push it onto the work board with the agreed delivery date.
    if (body.action === "contract") {
      if (quotation.status !== "approved") {
        return NextResponse.json({ error: "يجب اعتماد العرض أولاً قبل تحويله لعقد" }, { status: 400 });
      }
      if (!body.deliveryDate) {
        return NextResponse.json({ error: "تاريخ التسليم مطلوب" }, { status: 400 });
      }
      const updated = await prisma.quotation.update({
        where: { id },
        data: {
          status: "accepted",
          contractedAt: new Date(),
          deliveryDate: new Date(body.deliveryDate),
          deliveryTime: body.deliveryTime || null,
          deliveryDateEstimated: false,
          ...(quotation.workStatus ? {} : { workStatus: "needs_preparation" }),
        },
        include: { customer: true },
      });
      await logAction(user.id, "contract", "quotation", id, `converted to contract; delivery ${body.deliveryDate}`);
      await notifyAdmins(
        "تحويل إلى عقد 📄",
        `حوّل ${user.name} العرض ${updated.quoteNumber} إلى عقد — التسليم ${body.deliveryDate}`,
        "success",
        `/quotations/${id}`
      ).catch(() => {});
      return NextResponse.json(updated);
    }

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
        body.advancePct ?? quotation.advancePct ?? 15,
        { discountAmount: body.discountAmount ?? 0, advanceAmount: body.advanceAmount ?? null },
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
      // Default ON (unset = enabled) so behavior is unchanged until an admin
      // explicitly turns self-approval off to require manager approval.
      const selfApprove = (await getSetting("allow_self_approve", "true")) !== "false";
      const decision = canSetStatus({ role: user.role, status: body.status, selfApprove });
      if (!decision.ok) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    if (body.items) {
      const parsed = parseBody(updateQuotationItemsSchema, body);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });

      // Price-edit permission: non-editors may only submit approved prices.
      {
        const editorIds = await priceEditorIds().catch(() => [] as string[]);
        if (!canEditPrice(user.civilId, user.id, editorIds) && hasPriceOverride(body.items as any)) {
          return NextResponse.json({ error: "غير مصرّح بتعديل الأسعار — الأسعار المعتمدة فقط", code: "price_locked" }, { status: 403 });
        }
      }

      // Curtain counts are unrestricted on edit too — any number is allowed
      // (no wilayat minimum enforced).

      const result = await prisma.$transaction(async (tx) => {
        await tx.quoteItem.deleteMany({ where: { quotationId: id } });

        // Recompute every monetary field server-side — never trust client totals.
        const totals = computeQuoteTotals(
          body.items,
          body.vatRate ?? quotation.vatRate ?? 0.05,
          body.advancePct ?? quotation.advancePct ?? 15,
          { discountAmount: body.discountAmount ?? 0, advanceAmount: body.advanceAmount ?? null },
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
            discountType: "amount",
            discountValue: totals.discountAmount,
            discountAmount: totals.discountAmount,
            vatRate: totals.vatRate,
            vatAmount: totals.vatAmount,
            total: totals.total,
            advancePct: totals.advancePct,
            advanceAmount: totals.advanceAmount,
            advanceIsFixed: totals.advanceIsFixed,
            notes: body.notes,
            customerId: body.customerId,
            ...(locked && isManager ? {
              managerEditNote: String(body.editReason).trim(),
              managerEditedAt: new Date(),
            } : {}),
            ...(body.deliveryDate !== undefined ? {
              deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
              deliveryTime: body.deliveryDate ? (body.deliveryTime || null) : null,
              // A date saved from the edit screen is a manual confirmation, so
              // it's no longer an import estimate.
              deliveryDateEstimated: false,
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

    // Lightweight delivery-date save (no item changes). Lets the rep set/adjust
    // the delivery date on an accepted order so it flows into Work Orders.
    // Allowed even on a locked quote — it doesn't touch prices or items.
    if (body.deliveryDate !== undefined) {
      allowedFields.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
      allowedFields.deliveryTime = body.deliveryDate ? (body.deliveryTime || null) : null;
      allowedFields.deliveryDateEstimated = false;
      if (body.deliveryDate && !quotation.workStatus) allowedFields.workStatus = "needs_preparation";
    }

    if (body.status === "revised") {
      allowedFields.status = "revised";
      if (body.statusComment) allowedFields.statusComment = body.statusComment;
    }

    // Customer-info-only save (e.g. fixing a mistyped name on an imported
    // order) — updates the linked customer without requiring any item changes.
    // Doesn't touch prices, so it's allowed even on a financially locked quote.
    if (body.customer && body.customerId && !body.items) {
      const c = body.customer;
      if (!c.name || !String(c.name).trim()) {
        return NextResponse.json({ error: "اسم الزبون مطلوب" }, { status: 400 });
      }
      await prisma.customer.update({
        where: { id: body.customerId },
        data: {
          name: String(c.name).trim(),
          ...(c.phone !== undefined ? { phone: c.phone } : {}),
          ...(c.phoneCode !== undefined ? { phoneCode: c.phoneCode || "+968" } : {}),
          ...(c.governorate !== undefined ? { governorate: c.governorate } : {}),
          ...(c.wilayat !== undefined ? { wilayat: c.wilayat } : {}),
          ...(c.address !== undefined ? { address: c.address } : {}),
        },
      });
      await logAction(user.id, "update", "customer", body.customerId, "customer_info_edit");
    }

    // Pricing / advance / discount save WITHOUT re-sending items (the quick
    // "save customer data" button on the edit page). Totals are recomputed
    // server-side from the EXISTING items using the new VAT / advance / discount,
    // so money is never trusted from the client. On a locked quote the edit
    // reason is adopted automatically (typed one if given, else a default) so
    // there's still an audit trail without the extra step.
    const hasPricing = !body.items && (body.vatRate !== undefined || body.advancePct !== undefined || body.discountAmount !== undefined || body.advanceAmount !== undefined);
    if (hasPricing) {
      const existing = await prisma.quoteItem.findMany({ where: { quotationId: id }, orderBy: { sortOrder: "asc" } });
      const totals = computeQuoteTotals(
        existing.map((it) => ({ categoryId: it.categoryId, quantity: it.quantity, unitPrice: it.unitPrice, extras: it.extras, description: it.description })),
        body.vatRate ?? quotation.vatRate ?? 0.05,
        body.advancePct ?? quotation.advancePct ?? 15,
        {
          discountAmount: body.discountAmount ?? quotation.discountAmount ?? 0,
          advanceAmount: body.advanceAmount !== undefined ? body.advanceAmount : (quotation.advanceIsFixed ? quotation.advanceAmount : null),
        },
      );
      if (locked) {
        const paidAgg = await prisma.payment.aggregate({ where: { quotationId: id }, _sum: { amount: true } });
        const paid = roundMoney(paidAgg._sum.amount || 0);
        if (newTotalBelowPaid(totals.total, paid)) {
          return NextResponse.json({ error: `الإجمالي الجديد (${roundMoney(totals.total).toFixed(3)}) أقل من المبلغ المدفوع (${paid.toFixed(3)})`, code: "below_paid" }, { status: 400 });
        }
        allowedFields.managerEditNote = (typeof body.editReason === "string" && body.editReason.trim()) ? body.editReason.trim() : "تعديل الأسعار من صفحة بيانات الزبون";
        allowedFields.managerEditedAt = new Date();
      }
      allowedFields.subtotal = totals.subtotal;
      allowedFields.discountType = "amount";
      allowedFields.discountValue = totals.discountAmount;
      allowedFields.discountAmount = totals.discountAmount;
      allowedFields.vatRate = totals.vatRate;
      allowedFields.vatAmount = totals.vatAmount;
      allowedFields.total = totals.total;
      allowedFields.advancePct = totals.advancePct;
      allowedFields.advanceAmount = totals.advanceAmount;
      allowedFields.advanceIsFixed = totals.advanceIsFixed;
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

      if (body.status === "approved") {
        // Employees approve their own quotes now — let managers/admins know.
        await notifyAdmins("عرض سعر معتمد", `اعتمد ${user.name} عرض السعر ${updated.quoteNumber}`, "success", link);
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

    const quotation = await prisma.quotation.findFirst({
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

    // Soft delete: move to Trash instead of removing.
    await prisma.quotation.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.id } });
    await logAction(user.id, "delete", "quotation", id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("API error [/api/quotations/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
