import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notifications";

// Daily reminder: notify managers (and the assigned driver/technician) about
// deliveries and installations scheduled for tomorrow. Runs via Vercel Cron
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

    const [deliveries, installs] = await Promise.all([
      prisma.quotation.findMany({
        where: { workStatus: "ready_for_delivery", deliveryDate: { gte: start, lte: end } },
        select: { quoteNumber: true, deliveryDriver: true, customer: { select: { name: true } } },
      }),
      prisma.quotation.findMany({
        where: { workStatus: "ready_for_install", installDate: { gte: start, lte: end } },
        select: { quoteNumber: true, installTechnician: true, customer: { select: { name: true } } },
      }),
    ]);

    // Summary to managers/admins.
    if (deliveries.length > 0) {
      await notifyAdmins(
        "توصيلات الغد 🚚",
        `يوجد ${deliveries.length} طلب مجدول للتوصيل غداً.`,
        "info",
        "/delivery-schedule"
      ).catch(() => {});
    }
    if (installs.length > 0) {
      await notifyAdmins(
        "تركيبات الغد 🔧",
        `يوجد ${installs.length} طلب مجدول للتركيب غداً.`,
        "info",
        "/installation-schedule"
      ).catch(() => {});
    }

    // Per-person reminders for the assigned driver / technician (matched by name).
    const perPerson: Record<string, { deliveries: number; installs: number }> = {};
    for (const d of deliveries) if (d.deliveryDriver) (perPerson[d.deliveryDriver] ||= { deliveries: 0, installs: 0 }).deliveries++;
    for (const i of installs) if (i.installTechnician) (perPerson[i.installTechnician] ||= { deliveries: 0, installs: 0 }).installs++;

    const names = Object.keys(perPerson);
    if (names.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { name: { in: names }, isActive: true },
        select: { id: true, name: true },
      });
      for (const emp of employees) {
        const c = perPerson[emp.name];
        const parts: string[] = [];
        if (c.deliveries) parts.push(`${c.deliveries} توصيلة`);
        if (c.installs) parts.push(`${c.installs} تركيب`);
        if (parts.length === 0) continue;
        await notify(
          emp.id,
          "مهام الغد 📋",
          `لديك غداً: ${parts.join(" و ")}.`,
          "info",
          c.installs ? "/installation-schedule" : "/delivery-schedule"
        ).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, deliveries: deliveries.length, installs: installs.length });
  } catch (err) {
    console.error("Cron delivery-reminders error:", err);
    return NextResponse.json({ error: "Delivery reminders failed" }, { status: 500 });
  }
}
