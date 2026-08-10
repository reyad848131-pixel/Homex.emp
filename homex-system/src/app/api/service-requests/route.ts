import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { canEditFieldOps } from "@/lib/permissions";
import { normalizePhone } from "@/lib/text";

const TYPES = ["return", "maintenance"];

// Service & returns: available to admin/manager and to the work-orders
// permission (e.g. the driver role).
async function requireManager() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  if (!(await canEditFieldOps(user.role))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  try {
    const status = new URL(req.url).searchParams.get("status");
    const where: any = {};
    if (status && ["open", "scheduled", "resolved"].includes(status)) where.status = status;
    const requests = await prisma.serviceRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        quotation: {
          select: {
            id: true, quoteNumber: true,
            customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
          },
        },
      },
    });
    return NextResponse.json(requests);
  } catch (e) {
    console.error("API error [/api/service-requests]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const type = TYPES.includes(body.type) ? body.type : "maintenance";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    let quotationId = body.quotationId as string | undefined;
    // Preferred: look the customer up by name + phone and attach the request to
    // their most recent quotation (staff no longer need to know the quote number).
    if (!quotationId && (body.phone || body.customerName)) {
      const digits = normalizePhone(String(body.phone || "")).slice(-8);
      const name = String(body.customerName || "").trim();
      const customerWhere: Record<string, unknown> = {};
      if (digits) customerWhere.phone = { contains: digits };
      if (name) customerWhere.name = { contains: name };
      if (Object.keys(customerWhere).length === 0) {
        return NextResponse.json({ error: "الاسم أو رقم الهاتف مطلوب" }, { status: 400 });
      }
      const q = await prisma.quotation.findFirst({
        where: { customer: customerWhere },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!q) return NextResponse.json({ error: "لم يتم العثور على عميل بهذا الاسم أو رقم الهاتف" }, { status: 404 });
      quotationId = q.id;
    }
    // Backward-compatible: still accept a raw quote number if one is sent.
    if (!quotationId && body.quoteNumber) {
      const q = await prisma.quotation.findFirst({ where: { quoteNumber: String(body.quoteNumber).trim() }, select: { id: true } });
      if (!q) return NextResponse.json({ error: "رقم العرض غير موجود" }, { status: 404 });
      quotationId = q.id;
    }
    if (!quotationId) return NextResponse.json({ error: "Missing quotation" }, { status: 400 });

    const created = await prisma.serviceRequest.create({
      data: { quotationId, type, reason: reason || null, createdBy: auth.user.id },
      include: {
        quotation: {
          select: { id: true, quoteNumber: true, customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } } },
        },
      },
    });

    await logAction(auth.user.id, "create", "service_request", created.id, `${type} for ${created.quotation.quoteNumber}`);
    await notifyAdmins(
      type === "return" ? "طلب مرتجع جديد 🔄" : "طلب صيانة جديد 🔧",
      `العميل ${created.quotation.customer.name} — العرض ${created.quotation.quoteNumber}`,
      "warning",
      "/service-requests"
    ).catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("API error [/api/service-requests]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
