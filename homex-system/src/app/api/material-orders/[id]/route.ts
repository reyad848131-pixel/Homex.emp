import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

const STATUSES = ["needed", "ordered", "received"];

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
    if (STATUSES.includes(body.status)) {
      data.status = body.status;
      if (body.status === "ordered") data.orderedAt = new Date();
      if (body.status === "received") data.receivedAt = new Date();
    }
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null;
    if (body.quantity !== undefined) { const q = Number(body.quantity); if (Number.isFinite(q) && q > 0) data.quantity = q; }
    if (body.note !== undefined) data.note = body.note?.trim() || null;
    const updated = await prisma.materialOrder.update({ where: { id }, data, include: { supplier: true } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("API error [/api/material-orders/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const { id } = await params;
    await prisma.materialOrder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/material-orders/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
