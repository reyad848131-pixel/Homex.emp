import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { canEditFieldOps } from "@/lib/permissions";
import { normalizePhone } from "@/lib/text";

const TYPES = ["return", "maintenance", "completion"];
const TYPE_TITLE: Record<string, string> = {
  return: "طلب مرتجع جديد 🔄",
  maintenance: "طلب صيانة جديد 🔧",
  completion: "طلب تكملة أعمال جديد 🧰",
};

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
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
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
    const name = String(body.customerName || "").trim();
    const digits = normalizePhone(String(body.phone || "")).slice(-8);

    let quotationId: string | null = (body.quotationId as string) || null;
    let customerId: string | null = null;

    if (body.mode === "new") {
      // Brand-new customer with no quote yet: create (or reuse an existing
      // customer with the same phone) and attach the request straight to them.
      const governorate = String(body.governorate || "").trim();
      const wilayat = String(body.wilayat || "").trim();
      if (!name || !digits) return NextResponse.json({ error: "الاسم ورقم الهاتف مطلوبان" }, { status: 400 });
      if (!governorate || !wilayat) return NextResponse.json({ error: "المحافظة والولاية مطلوبتان" }, { status: 400 });

      const existing = await prisma.customer.findFirst({ where: { phone: { contains: digits } }, select: { id: true } });
      if (existing) {
        customerId = existing.id;
      } else {
        const c = await prisma.customer.create({
          data: { name, phone: digits, governorate, wilayat, source: "service", createdBy: auth.user.id },
          select: { id: true },
        });
        customerId = c.id;
      }
    } else if (!quotationId) {
      // Existing customer: find their most recent quotation by name + phone.
      const customerWhere: Record<string, unknown> = {};
      if (digits) customerWhere.phone = { contains: digits };
      if (name) customerWhere.name = { contains: name };
      if (Object.keys(customerWhere).length === 0 && !body.quoteNumber) {
        return NextResponse.json({ error: "الاسم أو رقم الهاتف مطلوب" }, { status: 400 });
      }
      if (Object.keys(customerWhere).length > 0) {
        const q = await prisma.quotation.findFirst({ where: { customer: customerWhere }, orderBy: { createdAt: "desc" }, select: { id: true } });
        if (q) quotationId = q.id;
      }
      // Backward-compatible: still accept a raw quote number if one is sent.
      if (!quotationId && body.quoteNumber) {
        const q = await prisma.quotation.findFirst({ where: { quoteNumber: String(body.quoteNumber).trim() }, select: { id: true } });
        if (q) quotationId = q.id;
      }
      if (!quotationId) return NextResponse.json({ error: "لم يتم العثور على عميل بهذا الاسم أو رقم الهاتف" }, { status: 404 });
    }

    if (!quotationId && !customerId) return NextResponse.json({ error: "Missing customer" }, { status: 400 });

    const created = await prisma.serviceRequest.create({
      data: { quotationId, customerId, type, reason: reason || null, createdBy: auth.user.id },
      include: {
        quotation: { select: { id: true, quoteNumber: true, customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } } } },
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
      },
    });

    const cust = created.quotation?.customer ?? created.customer;
    const ref = created.quotation ? `العرض ${created.quotation.quoteNumber}` : "عميل جديد";
    await logAction(auth.user.id, "create", "service_request", created.id, `${type} for ${created.quotation?.quoteNumber ?? cust?.name ?? "?"}`);
    await notifyAdmins(
      TYPE_TITLE[type] ?? TYPE_TITLE.maintenance,
      `العميل ${cust?.name ?? "?"} — ${ref}`,
      "warning",
      "/service-requests"
    ).catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("API error [/api/service-requests]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
