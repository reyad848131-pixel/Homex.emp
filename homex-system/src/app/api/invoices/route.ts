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

    // A sales rep may only invoice their own quotations.
    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (quotation.status !== "approved") return NextResponse.json({ error: "يجب اعتماد العرض أولاً" }, { status: 400 });
    if (quotation.invoice) return NextResponse.json({ error: "تم إصدار فاتورة لهذا العرض مسبقاً" }, { status: 400 });

    // Generate a unique invoice number, retrying on a concurrent-collision
    // (two invoices issued at the same instant would otherwise clash on the
    // unique invoiceNumber constraint).
    const year = new Date().getFullYear();
    let invoice = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await prisma.invoice.count({
        where: { invoiceNumber: { startsWith: `INV-${year}` } },
      });
      const invoiceNumber = `INV-${year}/${String(count + 1 + attempt).padStart(4, "0")}`;
      try {
        invoice = await prisma.invoice.create({
          data: { invoiceNumber, quotationId, issuedBy: user.id },
        });
        await logAction(user.id, "create", "invoice", invoice.id, JSON.stringify({ invoiceNumber, quotationId }));
        break;
      } catch (e: any) {
        // P2002 = unique constraint violation. If it was the quotationId (a
        // race that created the invoice elsewhere) stop; otherwise retry the number.
        if (e?.code === "P2002" && attempt < 4 && !e?.meta?.target?.includes?.("quotation_id")) {
          continue;
        }
        throw e;
      }
    }

    if (!invoice) return NextResponse.json({ error: "تعذّر إصدار رقم فاتورة فريد" }, { status: 409 });

    return NextResponse.json(invoice);
  } catch (e) {
    console.error("API error [/api/invoices]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
