import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

export const MATERIAL_CATEGORIES = ["fabric", "wood", "foam", "accessory", "other"];
export const MATERIAL_UNITS = ["meter", "sheet", "kg", "piece"];

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
    const materials = await prisma.material.findMany({ orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }] });
    return NextResponse.json(materials);
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
        supplierId: body.supplierId || null,
      },
    });
    return NextResponse.json(material, { status: 201 });
  } catch (e) {
    console.error("API error [/api/materials]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
