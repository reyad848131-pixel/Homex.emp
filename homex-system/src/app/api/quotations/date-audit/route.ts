import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { userCan } from "@/lib/permissions";

// ── Creation-date audit & fix ────────────────────────────────────────────────
// Imported quotations stored their createdAt from the sheet's booking/delivery
// column, so some ended up with a FUTURE date (a delivery date used as the
// creation date). A creation date can never be in the future, which scrambles
// the "newest first" sort. This tool finds those rows and corrects createdAt to
// a sane value: the delivery date when it's already in the past, otherwise now.
//
// GET  → preview (what would change, no writes)
// POST → apply the fix

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { id: string; role: string };
  const privileged = user.role === "admin" || user.role === "ceo" || user.role === "manager";
  if (!(privileged || (await userCan(user.role, "trash")))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

// The corrected creation date for a future-dated quote: never in the future.
function fixedDate(createdAt: Date, deliveryDate: Date | null, now: Date): Date {
  if (createdAt.getTime() <= now.getTime()) return createdAt; // already fine
  if (deliveryDate && deliveryDate.getTime() <= now.getTime()) return deliveryDate;
  return now;
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const now = new Date();
    // Only rows whose stored creation date is in the future are wrong.
    const rows = await prisma.quotation.findMany({
      where: { createdAt: { gt: now } } as any,
      select: { id: true, quoteNumber: true, createdAt: true, deliveryDate: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const items = rows.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customer?.name || "",
      createdAt: q.createdAt.toISOString(),
      deliveryDate: q.deliveryDate ? q.deliveryDate.toISOString() : null,
      proposedDate: fixedDate(q.createdAt, q.deliveryDate, now).toISOString(),
    }));
    return NextResponse.json({ count: items.length, items });
  } catch (e) {
    console.error("API error [/api/quotations/date-audit GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const now = new Date();
    const rows = await prisma.quotation.findMany({
      where: { createdAt: { gt: now } } as any,
      select: { id: true, createdAt: true, deliveryDate: true },
      take: 5000,
    });
    let fixed = 0;
    // Apply per-row (each needs its own corrected value).
    for (const q of rows) {
      const nd = fixedDate(q.createdAt, q.deliveryDate, now);
      if (nd.getTime() !== q.createdAt.getTime()) {
        await prisma.quotation.update({ where: { id: q.id }, data: { createdAt: nd } }).catch(() => {});
        fixed++;
      }
    }
    await logAction(g.user.id, "fix_dates", "quotation", undefined, JSON.stringify({ scanned: rows.length, fixed }));
    return NextResponse.json({ scanned: rows.length, fixed });
  } catch (e) {
    console.error("API error [/api/quotations/date-audit POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
