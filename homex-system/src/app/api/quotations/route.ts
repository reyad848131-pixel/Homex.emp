import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const isAdmin = user.role === "admin" || user.role === "manager";

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: any = isAdmin ? {} : { employeeId: user.id };
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search } },
      { customer: { name: { contains: search } } },
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
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();

  const { customer: customerData, items, notes, advancePct = 15 } = body;

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

  const subtotal = items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
  const vatAmount = subtotal * 0.05;
  const total = subtotal + vatAmount;
  const advanceAmount = total * (advancePct / 100);

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber: generateQuoteNumber(),
      customerId: customer.id,
      employeeId: user.id,
      status: "draft",
      subtotal,
      vatAmount,
      total,
      advancePct,
      advanceAmount,
      notes,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: {
        create: items.map((item: any, idx: number) => ({
          categoryId: item.categoryId,
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

  return NextResponse.json(quotation, { status: 201 });
}
