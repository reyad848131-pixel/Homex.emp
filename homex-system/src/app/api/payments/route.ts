import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { parseBody, paymentSchema } from "@/lib/schemas";
import { roundMoney } from "@/lib/utils";
import { isFinanciallyLocked } from "@/lib/quote-rules";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const parsed = parseBody(paymentSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    const { quotationId, amount, method, reference, notes } = parsed.data;

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId },
      select: {
        id: true, total: true, employeeId: true, quoteNumber: true, status: true, signedAt: true,
        invoice: { select: { id: true } }, _count: { select: { payments: true } },
      },
    });

    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isManager = user.role === "admin" || user.role === "manager" || user.role === "ceo";
    // Once the contract is locked (signed / invoiced / accepted / already has a
    // payment), only managers may record further payments. Before lock, the
    // quote owner may too.
    if (isFinanciallyLocked(quotation)) {
      if (!isManager) return NextResponse.json({ error: "بعد قفل العقد، فقط المدراء يسجّلون الدفعات", code: "locked" }, { status: 403 });
    } else if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Re-sum the existing payments and create the new one inside one transaction,
    // so two payments recorded at the same instant can't both pass the
    // remaining-balance check and overshoot the total (concurrency race).
    const payment = await prisma.$transaction(async (tx) => {
      const agg = await tx.payment.aggregate({ where: { quotationId }, _sum: { amount: true } });
      const paidSoFar = roundMoney(agg._sum.amount || 0);
      if (roundMoney(paidSoFar + amount) > roundMoney(quotation.total)) {
        throw Object.assign(new Error("overpay"), { code: "OVERPAY" });
      }
      return tx.payment.create({
        data: {
          quotationId,
          amount: roundMoney(amount),
          method: method || "cash",
          reference: reference || null,
          notes: notes || null,
          recordedBy: user.id,
        },
        include: { recorder: { select: { name: true } } },
      });
    });

    await logAction(user.id, "create", "payment", payment.id, `${amount} for ${quotation.quoteNumber}`);

    return NextResponse.json(payment, { status: 201 });
  } catch (e: any) {
    if (e?.code === "OVERPAY") {
      return NextResponse.json({ error: "المبلغ يتجاوز المتبقي" }, { status: 400 });
    }
    console.error("POST /api/payments error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
