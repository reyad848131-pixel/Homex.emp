import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { role: string };
    if (!(await userCan(user.role, "purchasing"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const movements = await prisma.stockMovement.findMany({
      where: { materialId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json(movements);
  } catch (e) {
    console.error("API error [/api/materials/[id]/movements]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
