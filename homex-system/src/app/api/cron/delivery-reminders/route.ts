import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notifications";

// Daily reminder: notify managers (and the assigned driver) about
// deliveries scheduled for tomorrow. Runs via Vercel Cron
// (see vercel.json); an admin can also trigger it manually.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
      const session = await getAuth();
      const user = session?.user as any;
      if (!session || (user?.role !== "admin" && user?.role !== "ceo" && user?.role !== "manager")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);

    const deliveries = await prisma.quotation.findMany({
      where: { workStatus: "ready_for_delivery", deliveryDate: { gte: start, lte: end } },
      select: { quoteNumber: true, deliveryDriver: true, customer: { select: { name: true } } },
    });

    // Summary to managers/admins.
    if (deliveries.length > 0) {
      await notifyAdmins(
        "توصيلات الغد 🚚",
        `يوجد ${deliveries.length} طلب مجدول للتوصيل غداً.`,
        "info",
        "/delivery-schedule"
      ).catch(() => {});
    }

    // Per-person reminders for the assigned driver (matched by name).
    const perPerson: Record<string, { deliveries: number }> = {};
    for (const d of deliveries) if (d.deliveryDriver) (perPerson[d.deliveryDriver] ||= { deliveries: 0 }).deliveries++;

    const names = Object.keys(perPerson);
    if (names.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { name: { in: names }, isActive: true },
        select: { id: true, name: true },
      });
      for (const emp of employees) {
        const c = perPerson[emp.name];
        if (!c.deliveries) continue;
        await notify(
          emp.id,
          "مهام الغد 📋",
          `لديك غداً: ${c.deliveries} توصيلة.`,
          "info",
          "/delivery-schedule"
        ).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, deliveries: deliveries.length });
  } catch (err) {
    console.error("Cron delivery-reminders error:", err);
    return NextResponse.json({ error: "Delivery reminders failed" }, { status: 500 });
  }
}
