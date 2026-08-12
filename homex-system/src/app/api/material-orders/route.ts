import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";
import { normalizeCredential } from "@/lib/text";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { id: string; role: string };
  if (!(await userCan(user.role, "purchasing"))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

const orderInclude = {
  customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
  materialOrders: { include: { supplier: true }, orderBy: { createdAt: "asc" as const } },
};

export async function GET(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim();
    if (search) {
      // Find matching orders to start/continue a material request on.
      const s = normalizeCredential(search);
      const orders = await prisma.quotation.findMany({
        where: {
          OR: [
            { quoteNumber: { contains: s, mode: "insensitive" } },
            { originalNumber: { contains: s, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
          ],
        },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      return NextResponse.json(orders);
    }
    // Default: every order that already has material requests (active procurement).
    const orders = await prisma.quotation.findMany({
      where: { materialOrders: { some: {} } },
      include: orderInclude,
      orderBy: { deliveryDate: "asc" },
      take: 200,
    });
    return NextResponse.json(orders);
  } catch (e) {
    console.error("API error [/api/material-orders]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const quotationId = String(body.quotationId || "");
    const name = String(body.name || "").trim();
    if (!quotationId || !name) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    const qty = Number(body.quantity);
    const created = await prisma.materialOrder.create({
      data: {
        quotationId,
        name,
        code: typeof body.code === "string" && body.code.trim() ? body.code.trim() : null,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        unit: body.unit || "meter",
        supplierId: body.supplierId || null,
        materialId: body.materialId || null,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
        createdBy: g.user.id,
      },
      include: { supplier: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("API error [/api/material-orders]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
