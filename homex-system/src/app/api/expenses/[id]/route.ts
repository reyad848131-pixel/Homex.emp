import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { userCan } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    if (!(await userCan(user.role, "financials"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await prisma.expense.delete({ where: { id } });
    await logAction(user.id, "delete", "expense", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/expenses/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
