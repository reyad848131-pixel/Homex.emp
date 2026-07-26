import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notifications";

// Public (token-gated, no login) customer decision on a shared quotation.
// Only quotes that are still open can be accepted/declined by the customer.
const ACTIONABLE = ["pending", "approved", "sent", "revised", "draft"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action === "accept" ? "accept" : body.action === "reject" ? "reject" : null;
    if (!action) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const quotation = await prisma.quotation.findUnique({
      where: { publicToken: token },
      select: { id: true, quoteNumber: true, status: true, employeeId: true },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!ACTIONABLE.includes(quotation.status)) {
      // Already decided / invoiced — report the current state, don't change it.
      return NextResponse.json({ ok: false, status: quotation.status, code: "closed" }, { status: 409 });
    }

    const newStatus = action === "accept" ? "accepted" : "declined";
    const comment = action === "accept" ? "قبول من العميل عبر الرابط" : "رفض من العميل عبر الرابط";

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { status: newStatus, statusComment: comment },
    });

    const link = `/quotations/${quotation.id}`;
    if (action === "accept") {
      await notify(quotation.employeeId, "قبل العميل العرض ✅", `وافق العميل على عرض السعر ${quotation.quoteNumber}`, "success", link).catch(() => {});
      await notifyAdmins("عرض مقبول من العميل", `تم قبول عرض السعر ${quotation.quoteNumber} من العميل عبر الرابط`, "success", link).catch(() => {});
    } else {
      await notify(quotation.employeeId, "رفض العميل العرض", `اعتذر العميل عن عرض السعر ${quotation.quoteNumber}`, "warning", link).catch(() => {});
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
