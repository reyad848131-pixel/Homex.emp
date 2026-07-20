import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/utils";
import { logAction } from "@/lib/audit";
import { getSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const isAdmin = user.role === "admin" || user.role === "manager";

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: any = isAdmin ? {} : { employeeId: user.id };
  if (status && status !== "all") where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
  }
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" as const } },
      { customer: { name: { contains: search, mode: "insensitive" as const } } },
      { customer: { phone: { contains: search } } },
    ];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: { customer: true, employee: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.quotation.count({ where }),
  ]);

    return NextResponse.json({ quotations, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = session.user as any;
    const body = await req.json();

    const { customer: customerData, items, notes, advancePct, deliveryDate } = body;

    if (!customerData?.name || !customerData?.phone || !customerData?.governorate || !customerData?.wilayat) {
      return NextResponse.json({ error: "بيانات العميل غير مكتملة" }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "يجب إضافة بند واحد على الأقل" }, { status: 400 });
    }

    let customer = await prisma.customer.findFirst({
      where: { phone: customerData.phone, createdBy: user.id },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerData.name,
          phone: customerData.phone,
          phoneCode: customerData.phoneCode || "+968",
          governorate: customerData.governorate,
          wilayat: customerData.wilayat,
          address: customerData.address,
          createdBy: user.id,
        },
      });
    }

    const cfg = await getSettings();
    const vatRate = (parseFloat(cfg.vat_rate || "5") || 5) / 100;
    const defaultAdvance = parseFloat(cfg.advance_pct || "15") || 15;
    const validityDays = parseInt(cfg.quote_validity_days || "30") || 30;
    const finalAdvancePct = advancePct ?? defaultAdvance;

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
    const vatAmount = Math.round(subtotal * vatRate * 1000) / 1000;
    const total = Math.round((subtotal + vatAmount) * 1000) / 1000;
    const advanceAmount = Math.round(total * (finalAdvancePct / 100) * 1000) / 1000;

    const quoteNumber = await generateQuoteNumber(prisma);

    const quotation = await prisma.quotation.create({
      data: {
        quoteNumber,
        customer: { connect: { id: customer.id } },
        employee: { connect: { id: user.id } },
        status: "draft",
        subtotal,
        vatRate,
        vatAmount,
        total,
        advancePct: finalAdvancePct,
        advanceAmount,
        notes,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        workStatus: deliveryDate ? "needs_preparation" : null,
        validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
        items: {
          create: items.map((item: any, idx: number) => ({
            category: { connect: { id: item.categoryId } },
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
      include: { customer: true, items: true },
    });

    await logAction(user.id, "create", "quotation", quotation.id).catch(() => {});
    return NextResponse.json(quotation, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/quotations error:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ أثناء حفظ العرض" }, { status: 500 });
  }
}
