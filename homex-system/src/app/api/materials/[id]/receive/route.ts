import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

// Receive a bulk purchase into the store: raise the material's stock and log
// the cost as a materials expense (so it flows into reports' costs / profit).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    if (!(await userCan(user.role, "purchasing"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const qty = Number(body.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: "الكمية غير صحيحة" }, { status: 400 });
    const cost = Number(body.cost);

    const material = await prisma.material.update({
      where: { id },
      data: { stock: { increment: qty } },
      select: { id: true, name: true, stock: true, minStock: true },
    });

    if (Number.isFinite(cost) && cost > 0) {
      await prisma.expense.create({
        data: { amount: cost, category: "materials", note: `مخزون: ${material.name} (+${qty})`, createdBy: user.id },
      }).catch(() => {});
    }

    return NextResponse.json(material);
  } catch (e) {
    console.error("API error [/api/materials/[id]/receive]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
