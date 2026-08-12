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
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    const material = await prisma.material.update({ where: { id }, data });
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
