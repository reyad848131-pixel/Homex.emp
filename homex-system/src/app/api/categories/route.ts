import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Builder-backed categories that must exist with a fixed id (so they dispatch
// to their dedicated builder). Seeded DBs predating a category won't have it,
// so we upsert it once per server instance on the first categories fetch.
const EXTRA_CATEGORIES = [
  {
    id: "pantry", nameAr: "بانتري", nameEn: "Pantry", icon: "Refrigerator",
    pricingType: "per_sqm", basePrice: 130, sortOrder: 2,
    config: JSON.stringify({ porcelainSurcharge: 55 }),
  },
  {
    id: "coffee-corner", nameAr: "كوفي كورنر", nameEn: "Coffee Corner", icon: "Coffee",
    pricingType: "per_sqm", basePrice: 60, sortOrder: 10,
    config: JSON.stringify({ pricePerSqm: 60 }),
  },
  {
    id: "partition", nameAr: "بارتشن", nameEn: "Partition", icon: "Columns2",
    pricingType: "per_sqm", basePrice: 65, sortOrder: 11,
    config: JSON.stringify({ pricePerSqm: 65 }),
  },
];

let ensuredExtras = false;
async function ensureBuilderCategories() {
  if (ensuredExtras) return;
  try {
    for (const c of EXTRA_CATEGORIES) {
      await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
    }
    ensuredExtras = true;
  } catch {
    // Non-fatal: fall back to whatever categories already exist.
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureBuilderCategories();

    const user = session.user as any;
    const showAll = req.nextUrl.searchParams.get("all") === "true" && (user.role === "admin" || user.role === "ceo");

    const categories = await prisma.category.findMany({
      where: showAll ? {} : { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    });

    const res = NextResponse.json(
      categories.map((c) => ({
        ...c,
        config: c.config ? JSON.parse(c.config) : {},
      }))
    );
    // Categories rarely change and are fetched on every quotation builder load;
    // cache them briefly in the browser so repeat navigation is instant. The
    // admin management view (all=true) is always served fresh.
    if (!showAll) {
      res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    }
    return res;
  } catch (e) {
    console.error("API error [/api/categories]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "ceo") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  } catch (e) {
    console.error("API error [/api/categories]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
