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
    const line = await prisma.materialOrder.findUnique({
      where: { id },
      select: { status: true, category: true, cost: true, quotationId: true, name: true },
    });
    if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (STATUSES.includes(body.status)) {
      data.status = body.status;
      if (body.status === "ordered") data.orderedAt = new Date();
      if (body.status === "received") data.receivedAt = new Date();
    }
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null;
    if (body.quantity !== undefined) { const q = Number(body.quantity); if (Number.isFinite(q) && q > 0) data.quantity = q; }
    if (body.cost !== undefined) { const c = Number(body.cost); data.cost = Number.isFinite(c) && c > 0 ? c : null; }
    if (body.note !== undefined) data.note = body.note?.trim() || null;
    const updated = await prisma.materialOrder.update({ where: { id }, data, include: { supplier: true } });

    const effectiveCost = body.cost !== undefined ? (Number.isFinite(Number(body.cost)) ? Number(body.cost) : 0) : (line.cost || 0);

    // Received for the first time with a cost → log it as a materials expense
    // (single-sourced, so it flows into the reports' costs and net profit).
    if (body.status === "received" && line.status !== "received" && effectiveCost > 0) {
      await prisma.expense.create({
        data: { amount: effectiveCost, category: "materials", note: `مواد: ${line.name}`, createdBy: g.user.id },
      }).catch(() => {});
    }

    // Keep the order's wood/fabric status on the work board in sync with its
    // material lines (all received → arrived; any ordered → ordered).
    const all = await prisma.materialOrder.findMany({ where: { quotationId: line.quotationId }, select: { category: true, status: true } });
    const agg = (cat: string) => {
      const rel = all.filter((l) => l.category === cat);
      if (rel.length === 0) return null;
      if (rel.every((l) => l.status === "received")) return "arrived";
      if (rel.some((l) => l.status === "ordered" || l.status === "received")) return "ordered";
      return "not_ordered";
    };
    const boardData: Record<string, unknown> = {};
    const wood = agg("wood"); if (wood) boardData.woodStatus = wood;
    const fabric = agg("fabric"); if (fabric) boardData.fabricStatus = fabric;
    if (Object.keys(boardData).length) await prisma.quotation.update({ where: { id: line.quotationId }, data: boardData }).catch(() => {});

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
