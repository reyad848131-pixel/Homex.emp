import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

export const MATERIAL_CATEGORIES = ["fabric", "wood", "foam", "accessory", "other"];
export const MATERIAL_UNITS = ["piece", "meter", "sheet", "kg", "carton", "box", "bag", "gallon", "roll"];

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { id: string; role: string };
  if (!(await userCan(user.role, "purchasing"))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const [materials, demand] = await Promise.all([
      prisma.material.findMany({ orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }], take: 2000 }),
      // Open demand across customer orders (still needed / not yet received).
      prisma.materialOrder.groupBy({ by: ["materialId"], where: { status: { in: ["needed", "ordered"] }, materialId: { not: null } }, _sum: { quantity: true } }),
    ]);
    const demandMap = new Map(demand.map((d) => [d.materialId, d._sum.quantity || 0]));
    return NextResponse.json(materials.map((m) => ({ ...m, demand: demandMap.get(m.id) || 0 })));
  } catch (e) {
    console.error("API error [/api/materials]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    const material = await prisma.material.create({
      data: {
        name,
        category: MATERIAL_CATEGORIES.includes(body.category) ? body.category : "fabric",
        code: typeof body.code === "string" && body.code.trim() ? body.code.trim() : null,
        unit: MATERIAL_UNITS.includes(body.unit) ? body.unit : "meter",
        packSize: typeof body.packSize === "string" && body.packSize.trim() ? body.packSize.trim() : null,
        supplierId: body.supplierId || null,
        stock: Number.isFinite(Number(body.stock)) ? Number(body.stock) : 0,
        minStock: Number.isFinite(Number(body.minStock)) ? Number(body.minStock) : 0,
      },
    });
    return NextResponse.json(material, { status: 201 });
  } catch (e) {
    console.error("API error [/api/materials]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
