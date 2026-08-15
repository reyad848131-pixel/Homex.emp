import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

// Consume (صرف) from the store: lower the material's stock by the given
// quantity and log the negative delta in the ledger. Used when a resource is
// taken out for a job — stock drops and, when it crosses the reorder point,
// the store shows a "danger / needs order" status.
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

    // Never let stock go negative.
    const cur = await prisma.material.findUnique({ where: { id }, select: { stock: true } });
    if (!cur) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const take = Math.min(qty, cur.stock);
    if (take <= 0) return NextResponse.json({ error: "لا يوجد رصيد للصرف" }, { status: 400 });

    const material = await prisma.material.update({
      where: { id },
      data: { stock: { decrement: take } },
      select: { id: true, name: true, stock: true, minStock: true },
    });
    await prisma.stockMovement.create({
      data: { materialId: id, delta: -take, reason: "consume", note: body.note || null, createdBy: user.id },
    }).catch(() => {});

    return NextResponse.json(material);
  } catch (e) {
    console.error("API error [/api/materials/[id]/consume]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
