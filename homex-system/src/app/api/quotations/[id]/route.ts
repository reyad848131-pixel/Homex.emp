import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      employee: { select: { id: true, name: true, civilId: true } },
      items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(quotation);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { id } = await params;
  const body = await req.json();

  if (body.status) {
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && ["approved", "declined"].includes(body.status)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  }

  if (body.items) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quotationId: id } });

      const subtotal = body.items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
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

  const updated = await prisma.quotation.update({
    where: { id },
    data: body,
    include: { customer: true, items: { include: { category: true } } },
  });

  if (body.status) {
    await logAction(user.id, "status_change", "quotation", id, JSON.stringify({ to: body.status }));
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
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
}
