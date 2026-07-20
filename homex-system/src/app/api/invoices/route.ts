import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { quotationId } = await req.json();

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { invoice: true },
    });

    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quotation.status !== "approved") return NextResponse.json({ error: "يجب اعتماد العرض أولاً" }, { status: 400 });
    if (quotation.invoice) return NextResponse.json({ error: "تم إصدار فاتورة لهذا العرض مسبقاً" }, { status: 400 });

    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}` } },
    });
    const invoiceNumber = `INV-${year}/${String(count + 1).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        quotationId,
        issuedBy: user.id,
      },
    });

    await logAction(user.id, "create", "invoice", invoice.id, JSON.stringify({ invoiceNumber, quotationId }));

    return NextResponse.json(invoice);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
