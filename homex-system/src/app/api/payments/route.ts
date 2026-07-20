import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const body = await req.json();
    const { quotationId, amount, method, reference, notes } = body;

    if (!quotationId || !amount || amount <= 0) {
      return NextResponse.json({ error: "بيانات الدفعة غير صحيحة" }, { status: 400 });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { payments: true },
    });

    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const totalPaid = quotation.payments.reduce((s, p) => s + p.amount, 0);
    if (totalPaid + amount > quotation.total) {
      return NextResponse.json({ error: "المبلغ يتجاوز المتبقي" }, { status: 400 });
    }

    const payment = await prisma.payment.create({
      data: {
        quotationId,
        amount,
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
