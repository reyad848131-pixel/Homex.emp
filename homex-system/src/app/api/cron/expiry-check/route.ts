import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

// Notify the owning employee about quotations whose validity is about to expire,
// so they can follow up before the offer lapses. Runs daily via Vercel Cron
// (see vercel.json); can also be triggered manually by an admin.
const DAYS_AHEAD = 3;
const OPEN_STATUSES = ["draft", "pending", "revised", "approved"];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
      const session = await getAuth();
      const user = session?.user as any;
      if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

    const expiring = await prisma.quotation.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        expiryNotified: false,
        validUntil: { not: null, gte: now, lte: cutoff },
      },
      select: { id: true, quoteNumber: true, employeeId: true, validUntil: true },
    });

    for (const q of expiring) {
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(q.validUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      await notify(
        q.employeeId,
        "عرض قرب انتهاء صلاحيته",
        `عرض السعر ${q.quoteNumber} تنتهي صلاحيته خلال ${daysLeft} يوم — تابع العميل قبل فواته.`,
        "warning",
        `/quotations/${q.id}`
      ).catch(() => {});
      await prisma.quotation
        .update({ where: { id: q.id }, data: { expiryNotified: true } })
        .catch(() => {});
    }

    return NextResponse.json({ ok: true, notified: expiring.length });
  } catch (err) {
    console.error("Cron expiry-check error:", err);
    return NextResponse.json({ error: "Expiry check failed" }, { status: 500 });
  }
}
