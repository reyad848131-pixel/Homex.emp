import { prisma } from "@/lib/prisma";

// Foreman console data. All "day" params are YYYY-MM-DD in the company's local
// zone; we bound queries to that whole day.

export function dayBounds(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  const end = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return { start, end };
}

// A quotation is "active" on the board while it is not yet delivered.
const ACTIVE_WORK = ["needs_preparation", "ready_to_execute", "in_progress", "ready_for_delivery"];

export interface ForemanTask {
  id: string; stage: string; workerId: string | null; doneAt: string | null;
  itemDesc: string; quoteId: string; quoteNumber: string; customer: string;
}

// The live worker board for one day.
export async function getForemanBoard(dateStr: string) {
  const { start, end } = dayBounds(dateStr);

  const [workers, attendance, openTasks, doneToday, readyPool, crews] = await Promise.all([
    prisma.worker.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.workerAttendance.findMany({ where: { date: { gte: start, lte: end } } }),
    // Assigned, not-done tasks on active (undelivered) quotes.
    prisma.itemTask.findMany({
      where: { workerId: { not: null }, doneAt: null, quoteItem: { quotation: { workStatus: { in: ACTIVE_WORK } } } },
      include: { quoteItem: { select: { description: true, quotation: { select: { id: true, quoteNumber: true, customer: { select: { name: true } } } } } } },
      orderBy: { sortOrder: "asc" },
      take: 2000,
    }),
    // Tasks marked done during this day.
    prisma.itemTask.findMany({
      where: { doneAt: { gte: start, lte: end } },
      include: { quoteItem: { select: { description: true, quotation: { select: { id: true, quoteNumber: true, customer: { select: { name: true } } } } } } },
      take: 2000,
    }),
    // Unassigned, not-done tasks on active quotes — the pool to hand out.
    prisma.itemTask.findMany({
      where: { workerId: null, doneAt: null, quoteItem: { quotation: { workStatus: { in: ACTIVE_WORK } } } },
      include: { quoteItem: { select: { description: true, quotation: { select: { id: true, quoteNumber: true, customer: { select: { name: true } } } } } } },
      orderBy: { sortOrder: "asc" },
      take: 500,
    }),
    // Install crews scheduled for this day (so we know who's out on sites).
    prisma.installCrew.findMany({
      where: { date: { gte: start, lte: end } },
      include: { members: true },
    }),
  ]);

  const attByWorker = new Map(attendance.map((a) => [a.workerId, a]));
  const onCrew = new Set<string>();
  for (const c of crews) for (const m of c.members) onCrew.add(m.workerId);

  const shape = (t: any): ForemanTask => ({
    id: t.id, stage: t.stage, workerId: t.workerId, doneAt: t.doneAt ? t.doneAt.toISOString() : null,
    itemDesc: t.quoteItem?.description || "", quoteId: t.quoteItem?.quotation?.id || "",
    quoteNumber: t.quoteItem?.quotation?.quoteNumber || "", customer: t.quoteItem?.quotation?.customer?.name || "",
  });

  const openByWorker = new Map<string, ForemanTask[]>();
  for (const t of openTasks) { const k = t.workerId!; (openByWorker.get(k) || openByWorker.set(k, []).get(k)!).push(shape(t)); }
  const doneByWorker = new Map<string, ForemanTask[]>();
  for (const t of doneToday) if (t.workerId) { const k = t.workerId; (doneByWorker.get(k) || doneByWorker.set(k, []).get(k)!).push(shape(t)); }

  const workerCards = workers.map((w) => ({
    id: w.id, name: w.name, color: w.color,
    status: attByWorker.get(w.id)?.status || "present",
    note: attByWorker.get(w.id)?.note || "",
    onCrew: onCrew.has(w.id),
    open: openByWorker.get(w.id) || [],
    doneToday: doneByWorker.get(w.id) || [],
  }));

  return {
    workers: workerCards,
    ready: readyPool.map(shape),
    onSiteCount: onCrew.size,
  };
}

// Install jobs for a day: every quote whose delivery is dispatched that day,
// each with its crew (required vs assigned) so the foreman can staff it.
export async function getForemanInstalls(dateStr: string) {
  const { start, end } = dayBounds(dateStr);
  const [quotes, crews] = await Promise.all([
    prisma.quotation.findMany({
      where: { dispatchDate: { gte: start, lte: end } },
      select: {
        id: true, quoteNumber: true, deliveryLocation: true, deliveryTime: true, workStatus: true,
        customer: { select: { name: true, governorate: true, wilayat: true } },
      },
      orderBy: { deliveryTime: "asc" },
    }),
    prisma.installCrew.findMany({
      where: { date: { gte: start, lte: end } },
      include: { members: { include: { worker: { select: { id: true, name: true, color: true } } } } },
    }),
  ]);
  const crewByQuote = new Map(crews.map((c) => [c.quotationId, c]));
  return quotes.map((q) => {
    const c = crewByQuote.get(q.id);
    return {
      quoteId: q.id, quoteNumber: q.quoteNumber,
      customer: q.customer?.name || "",
      location: q.deliveryLocation || [q.customer?.wilayat, q.customer?.governorate].filter(Boolean).join(" - "),
      time: q.deliveryTime || "",
      crewId: c?.id || null,
      requiredCount: c?.requiredCount ?? 1,
      notes: c?.notes || "",
      members: (c?.members || []).map((m) => ({ workerId: m.workerId, name: m.worker?.name || "", color: m.worker?.color || "#999" })),
    };
  });
}

// Performance report over a range: per-worker productivity (tasks done),
// site log (installs attended) and attendance days.
export async function getForemanReport(fromStr: string, toStr: string) {
  const start = dayBounds(fromStr).start;
  const end = dayBounds(toStr).end;

  const [workers, done, crewMembers, attendance] = await Promise.all([
    prisma.worker.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.itemTask.findMany({
      where: { doneAt: { gte: start, lte: end }, workerId: { not: null } },
      select: { workerId: true, stage: true, doneAt: true, quoteItem: { select: { quotation: { select: { quoteNumber: true } } } } },
    }),
    prisma.crewMember.findMany({
      where: { crew: { date: { gte: start, lte: end } } },
      include: { crew: { select: { date: true, quotation: { select: { quoteNumber: true } } } } },
    }),
    prisma.workerAttendance.findMany({ where: { date: { gte: start, lte: end } } }),
  ]);

  const rows = workers.map((w) => {
    const tasks = done.filter((d) => d.workerId === w.id);
    const installs = crewMembers.filter((m) => m.workerId === w.id);
    const att = attendance.filter((a) => a.workerId === w.id);
    return {
      workerId: w.id, name: w.name,
      tasksDone: tasks.length,
      installs: installs.length,
      daysPresent: att.filter((a) => a.status === "present" || a.status === "onsite").length,
      daysAbsent: att.filter((a) => a.status === "absent").length,
      installLog: installs.map((m) => ({ date: m.crew.date.toISOString().slice(0, 10), quote: m.crew.quotation?.quoteNumber || "" })),
    };
  });

  return { from: fromStr, to: toStr, rows };
}
