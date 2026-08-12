import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";
import { normalizePhone } from "@/lib/text";

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
    if (typeof body.phone === "string") data.phone = normalizePhone(body.phone).slice(-8);
    if (typeof body.phoneCode === "string") data.phoneCode = body.phoneCode || "+968";
    if (body.category !== undefined) data.category = body.category || null;
    if (body.note !== undefined) data.note = body.note?.trim() || null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    const supplier = await prisma.supplier.update({ where: { id }, data });
    return NextResponse.json(supplier);
  } catch (e) {
    console.error("API error [/api/suppliers/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const { id } = await params;
    // Keep history intact if the supplier is used; just deactivate.
    const used = await prisma.materialOrder.count({ where: { supplierId: id } });
    if (used > 0) {
      await prisma.supplier.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ deactivated: true });
    }
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/suppliers/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
