import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { clientIp } from "@/lib/rate-limit";

// In-person contract signing: the customer signs on the rep's device. Captures
// the same signature record as the public link and locks the quotation.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
    const signatureData = typeof body.signatureData === "string" ? body.signatureData : "";
    if (!signerName) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!signatureData.startsWith("data:image/png;base64,") || signatureData.length > 600_000) {
      return NextResponse.json({ error: "التوقيع غير صالح" }, { status: 400 });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, quoteNumber: true, employeeId: true, signedAt: true },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (quotation.signedAt) {
      return NextResponse.json({ error: "العرض موقّع مسبقاً" }, { status: 409 });
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        status: "accepted",
        statusComment: "قبول وتوقيع حضوري",
        signerName,
        signatureData,
        signedAt: new Date(),
        signerIp: clientIp(req),
      },
      include: { customer: true, items: { include: { category: true } } },
    });

    await logAction(user.id, "sign", "quotation", id, `signed by ${signerName}`);
    await notifyAdmins("توقيع عقد", `تم توقيع عرض السعر ${quotation.quoteNumber} حضورياً بواسطة ${signerName}`, "success", `/quotations/${id}`).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    console.error("API error [/api/quotations/[id]/sign]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
