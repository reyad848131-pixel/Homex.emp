import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const showAll = req.nextUrl.searchParams.get("all") === "true" && user.role === "admin";

  const categories = await prisma.category.findMany({
    where: showAll ? {} : { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json(
    categories.map((c) => ({
      ...c,
      config: c.config ? JSON.parse(c.config) : {},
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (!body.nameAr || !body.nameEn || !body.pricingType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: {
      nameAr: body.nameAr,
      nameEn: body.nameEn,
      icon: body.icon || null,
      pricingType: body.pricingType,
      basePrice: body.basePrice ? parseFloat(body.basePrice) : null,
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
