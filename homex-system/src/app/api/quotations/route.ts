import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber, withUniqueRetry, parseIntParam } from "@/lib/utils";
import { logAction } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { computeQuoteTotals } from "@/lib/quote-calc";
import { parseBody, createQuotationSchema } from "@/lib/schemas";
import { getQuotationsList } from "@/lib/quotations-list";
import { userCan } from "@/lib/permissions";
import { priceEditorIds, canEditPrice, hasPriceOverride } from "@/lib/price-permission";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const isAdmin = (user.role === "admin" || user.role === "ceo") || user.role === "manager" || await userCan(user.role, "view_all_quotes");

    const { searchParams } = new URL(req.url);
    const result = await getQuotationsList({
      userId: user.id,
      isAdmin,
      status: searchParams.get("status"),
      search: searchParams.get("search"),
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
      sort: (["delivery", "number"].includes(searchParams.get("sort") || "") ? searchParams.get("sort") : "recent") as "delivery" | "number" | "recent",
      page: parseIntParam(searchParams.get("page"), 1),
      limit: parseIntParam(searchParams.get("limit"), 20, 1, 100),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("API error [/api/quotations]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = session.user as any;
    // Only roles that may create quotations (sales/manager/admin, or any custom
    // role granted the permission). Blocks e.g. the accountant from creating.
    if (!(await userCan(user.role, "quotes_create"))) {
      return NextResponse.json({ error: "غير مصرّح بإنشاء عروض" }, { status: 403 });
    }
    const parsed = parseBody(createQuotationSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });

    const { customer: customerData, items, notes, advancePct, discountAmount, advanceAmount, deliveryDate, deliveryTime } = parsed.data;

    // Price-edit permission: users who aren't the owner or a designated price
    // editor may only submit approved (auto-computed) prices — reject any manual
    // override or manual-priced item, mirroring the locked UI.
    {
      const editorIds = await priceEditorIds().catch(() => [] as string[]);
      if (!canEditPrice(user.role, user.id, editorIds)) {
        const cats = await prisma.category.findMany({ select: { id: true, pricingType: true, basePrice: true } });
        const catById = new Map(cats.map((c) => [c.id, { pricingType: c.pricingType, basePrice: c.basePrice || 0 }]));
        if (hasPriceOverride(items as any, catById)) {
          return NextResponse.json({ error: "غير مصرّح بتعديل الأسعار — الأسعار المعتمدة فقط", code: "price_locked" }, { status: 403 });
        }
      }
    }

    // Curtain counts are unrestricted — any number is allowed (no wilayat
    // minimum enforced).

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
    const totals = computeQuoteTotals(items, vatRate, finalAdvancePct, {
      discountAmount: discountAmount ?? 0,
      advanceAmount: advanceAmount ?? null,
    });

    const quotation = await withUniqueRetry(async () => {
      const quoteNumber = await generateQuoteNumber(prisma);
      return prisma.quotation.create({
      data: {
        quoteNumber,
        customer: { connect: { id: customer.id } },
        employee: { connect: { id: user.id } },
        status: "draft",
        subtotal: totals.subtotal,
        discountType: "amount",
        discountValue: totals.discountAmount,
        discountAmount: totals.discountAmount,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        total: totals.total,
        advancePct: totals.advancePct,
        advanceAmount: totals.advanceAmount,
        advanceIsFixed: totals.advanceIsFixed,
        notes,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        deliveryTime: deliveryDate ? (deliveryTime || null) : null,
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
    });

    await logAction(user.id, "create", "quotation", quotation.id).catch(() => {});
    return NextResponse.json(quotation, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/quotations error:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ أثناء حفظ العرض" }, { status: 500 });
  }
}
