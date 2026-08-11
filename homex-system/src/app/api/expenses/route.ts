import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { userCan } from "@/lib/permissions";

export const CATEGORIES = ["materials", "labor", "rent", "utilities", "transport", "other"];

// Managing costs is financial data — gated on the "financials" permission
// (admin/ceo/manager/accountant).
async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { id: string; role: string };
  if (!(await userCan(user.role, "financials"))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const period = req.nextUrl.searchParams.get("period");
    const where: { spentAt?: { gte: Date } } = {};
    if (period) {
      const now = new Date();
      if (period === "week") where.spentAt = { gte: new Date(now.getTime() - 7 * 864e5) };
      else if (period === "year") where.spentAt = { gte: new Date(now.getFullYear(), 0, 1) };
      else if (period === "month") where.spentAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { spentAt: "desc" },
      take: 500,
      include: { creator: { select: { name: true } } },
    });
    return NextResponse.json(expenses);
  } catch (e) {
    console.error("API error [/api/expenses]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });
    }
    const category = CATEGORIES.includes(body.category) ? body.category : "other";
    const created = await prisma.expense.create({
      data: {
        amount: Math.round(amount * 1000) / 1000,
        category,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
        spentAt: body.spentAt ? new Date(body.spentAt) : new Date(),
        createdBy: g.user.id,
      },
      include: { creator: { select: { name: true } } },
    });
    await logAction(g.user.id, "create", "expense", created.id, `${category} ${created.amount}`);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("API error [/api/expenses]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
