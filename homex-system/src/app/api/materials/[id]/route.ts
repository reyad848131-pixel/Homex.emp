import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";
import { MATERIAL_CATEGORIES, MATERIAL_UNITS } from "../route";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { id: string; role: string };
  if (!(await userCan(user.role, "purchasing"))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (MATERIAL_CATEGORIES.includes(body.category)) data.category = body.category;
    if (body.code !== undefined) data.code = body.code?.trim() || null;
    if (MATERIAL_UNITS.includes(body.unit)) data.unit = body.unit;
    if (body.packSize !== undefined) data.packSize = body.packSize?.trim() || null;
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null;
    // Manual stock adjustment → record the delta in the ledger.
    let stockDelta = 0;
    if (body.stock !== undefined) {
      const n = Number(body.stock);
      if (Number.isFinite(n)) {
        data.stock = n;
        const cur = await prisma.material.findUnique({ where: { id }, select: { stock: true } });
        stockDelta = n - (cur?.stock ?? 0);
      }
    }
    if (body.minStock !== undefined) { const n = Number(body.minStock); if (Number.isFinite(n)) data.minStock = n; }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    const material = await prisma.material.update({ where: { id }, data });
    if (stockDelta !== 0) {
      await prisma.stockMovement.create({ data: { materialId: id, delta: stockDelta, reason: "adjust", createdBy: g.user.id } }).catch(() => {});
    }
    return NextResponse.json(material);
  } catch (e) {
    console.error("API error [/api/materials/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const { id } = await params;
    await prisma.material.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/materials/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
