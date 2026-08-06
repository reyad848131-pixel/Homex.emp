import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

// Worker productivity for a date range (defaults to the current month):
// completed stages, on-time rate, current load, and per-worker breakdown.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { role: string };
    if (!(await userCan(user.role, "reports"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");
    const start = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    const [workers, doneTasks, load] = await Promise.all([
      prisma.worker.findMany({ select: { id: true, name: true, color: true, isActive: true } }),
      // Stages completed in the range, with the order's delivery date for on-time.
      prisma.itemTask.findMany({
        where: { workerId: { not: null }, doneAt: { gte: start, lte: end }, quoteItem: { quotation: { deletedAt: null } } },
        select: { workerId: true, doneAt: true, quoteItem: { select: { quotation: { select: { deliveryDate: true } } } } },
      }),
      // Currently assigned but not-yet-done stages (current load), all-time.
      prisma.itemTask.groupBy({ by: ["workerId"], where: { workerId: { not: null }, doneAt: null }, _count: true }),
    ]);

    const loadBy = new Map<string, number>();
    for (const l of load) if (l.workerId) loadBy.set(l.workerId, l._count);

    type Agg = { completed: number; onTime: number; lastDone: Date | null };
    const agg = new Map<string, Agg>();
    for (const tk of doneTasks) {
      if (!tk.workerId || !tk.doneAt) continue;
      const a = agg.get(tk.workerId) || { completed: 0, onTime: 0, lastDone: null };
      a.completed++;
      const dd = tk.quoteItem?.quotation?.deliveryDate;
      if (dd && tk.doneAt <= new Date(dd)) a.onTime++;
      if (!a.lastDone || tk.doneAt > a.lastDone) a.lastDone = tk.doneAt;
      agg.set(tk.workerId, a);
    }

    const rows = workers.map((w) => {
      const a = agg.get(w.id) || { completed: 0, onTime: 0, lastDone: null };
      return {
        id: w.id, name: w.name, color: w.color, isActive: w.isActive,
        completed: a.completed,
        onTimeRate: a.completed ? Math.round((a.onTime / a.completed) * 100) : null,
        currentLoad: loadBy.get(w.id) || 0,
        lastDone: a.lastDone ? a.lastDone.toISOString() : null,
      };
    }).sort((x, y) => y.completed - x.completed);

    const totalCompleted = doneTasks.length;
    const onTimeTotal = [...agg.values()].reduce((s, a) => s + a.onTime, 0);
    const activeWorkers = rows.filter((r) => r.completed > 0).length;
    const star = rows.find((r) => r.completed > 0) || null;

    return NextResponse.json({
      range: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
      totals: {
        totalCompleted,
        activeWorkers,
        onTimeRate: totalCompleted ? Math.round((onTimeTotal / totalCompleted) * 100) : null,
      },
      star,
      rows,
    });
  } catch (e) {
    console.error("API error [/api/reports/workers]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
