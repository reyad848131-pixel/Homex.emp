import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { parseBody, paymentSchema } from "@/lib/schemas";
import { roundMoney } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const parsed = parseBody(paymentSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    const { quotationId, amount, method, reference, notes } = parsed.data;

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { payments: true },
    });

    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const totalPaid = quotation.payments.reduce((s, p) => roundMoney(s + p.amount), 0);
    if (roundMoney(totalPaid + amount) > roundMoney(quotation.total)) {
      return NextResponse.json({ error: "المبلغ يتجاوز المتبقي" }, { status: 400 });
    }

    const payment = await prisma.payment.create({
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

    await logAction(user.id, "create", "payment", payment.id, `${amount} for ${quotation.quoteNumber}`);

    return NextResponse.json(payment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
