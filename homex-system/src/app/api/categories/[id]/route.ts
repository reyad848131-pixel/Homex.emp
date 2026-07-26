import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const category = await prisma.category.update({
      where: { id },
      data: {
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        icon: body.icon || null,
        pricingType: body.pricingType,
        basePrice: body.basePrice ? parseFloat(body.basePrice) : null,
        sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
      },
    });

    return NextResponse.json(category);
  } catch (e) {
    console.error("API error [/api/categories/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    const itemCount = await prisma.quoteItem.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      await prisma.category.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ deactivated: true });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("API error [/api/categories/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
