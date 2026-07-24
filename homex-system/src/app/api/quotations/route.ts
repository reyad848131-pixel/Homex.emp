import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/utils";
import { logAction } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { computeQuoteTotals } from "@/lib/quote-calc";
import { parseBody, createQuotationSchema } from "@/lib/schemas";

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
    const parsed = parseBody(createQuotationSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });

    const { customer: customerData, items, notes, advancePct, deliveryDate } = parsed.data;

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

    // Recompute every monetary field server-side — never trust client totals.
    const totals = computeQuoteTotals(items, vatRate, finalAdvancePct);

    const quoteNumber = await generateQuoteNumber(prisma);

    const quotation = await prisma.quotation.create({
      data: {
        quoteNumber,
        customer: { connect: { id: customer.id } },
        employee: { connect: { id: user.id } },
        status: "draft",
        subtotal: totals.subtotal,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        total: totals.total,
        advancePct: totals.advancePct,
        advanceAmount: totals.advanceAmount,
        notes,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        workStatus: deliveryDate ? "needs_preparation" : null,
        validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
        items: {
          create: totals.items.map((item) => ({
            category: { connect: { id: item.categoryId } },
            description: item.description,
            details: item.details,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extras: item.extras,
            lineTotal: item.lineTotal,
            sortOrder: item.sortOrder,
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
