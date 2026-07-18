import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/utils";
import { logAction } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { id } = await params;

  const original = await prisma.quotation.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber: generateQuoteNumber(),
      customerId: original.customerId,
      employeeId: user.id,
      status: "draft",
      subtotal: original.subtotal,
      vatRate: original.vatRate,
      vatAmount: original.vatAmount,
      total: original.total,
      advancePct: original.advancePct,
      advanceAmount: original.advanceAmount,
      notes: original.notes,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: {
        create: original.items.map((item) => ({
          category: { connect: { id: item.categoryId } },
          description: item.description,
          details: item.details ?? undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extras: item.extras,
          lineTotal: item.lineTotal,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });

  await logAction(user.id, "duplicate", "quotation", quotation.id, `from:${id}`);
  return NextResponse.json(quotation, { status: 201 });
}
