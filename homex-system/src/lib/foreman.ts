import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { mergeProduction, type ProductionConfig } from "@/lib/production";
import { mergeSpecsCatalog, type SpecsCatalog } from "@/lib/specs-catalog";

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

// ── Production structure config (stations + pipelines) and specs catalog ──

export async function getProductionConfig(): Promise<ProductionConfig> {
  let stored: unknown = {};
  try { stored = JSON.parse((await getSetting("production", "")) || "{}"); } catch { stored = {}; }
  return mergeProduction(stored);
}

export async function getSpecsCatalog(): Promise<SpecsCatalog> {
  let stored: unknown = {};
  try { stored = JSON.parse((await getSetting("specs_catalog", "")) || "{}"); } catch { stored = {}; }
  return mergeSpecsCatalog(stored);
}

// Parse an item's details JSON and resolve its production specs (field id ->
// value) into labelled rows using the catalog. Unknown/removed fields are kept
// (labelled by their id) so nothing silently disappears.
function specRows(detailsRaw: string | null, catalog: SpecsCatalog) {
  let specs: Record<string, string> = {};
  try {
    const d = detailsRaw ? JSON.parse(detailsRaw) : null;
    if (d && typeof d.specs === "object" && d.specs) specs = d.specs;
  } catch { /* ignore malformed details */ }
  const rows: { labelAr: string; labelEn: string; value: string }[] = [];
  for (const [fid, val] of Object.entries(specs)) {
    const value = typeof val === "string" ? val.trim() : "";
    if (!value) continue;
    const f = catalog.fields.find((x) => x.id === fid);
    rows.push({ labelAr: f?.labelAr || fid, labelEn: f?.labelEn || fid, value });
  }
  return rows;
}

// The production file: every active (إدارة الأعمال) quotation with its items,
// each item's full production specs and its production stages (tasks). This is
// what the foreman and workers read to know exactly what to build — wood,
// fabric, colour, channels, dimensions (in the description) and who does which
// stage. Scoped strictly to signed/accepted work in progress.
export async function getProductionFile() {
  const [catalog, config, quotes, workers, categories] = await Promise.all([
    getSpecsCatalog(),
    getProductionConfig(),
    prisma.quotation.findMany({
      where: { workStatus: { in: ACTIVE_WORK }, deletedAt: null },
      select: {
        id: true, quoteNumber: true, workStatus: true, deliveryDate: true,
        customer: { select: { name: true, phone: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, categoryId: true, description: true, details: true, quantity: true,
            tasks: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, stage: true, workerId: true, doneAt: true, worker: { select: { name: true, color: true } } },
            },
          },
        },
      },
      orderBy: [{ deliveryDate: "asc" }, { quoteNumber: "asc" }],
      take: 1000,
    }),
    prisma.worker.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameAr: true, nameEn: true } }).catch(() => [] as { id: string; nameAr: string; nameEn: string }[]),
  ]);

  const workerName = new Map(workers.map((w) => [w.id, w.name]));

  const mappedQuotes = quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    workStatus: q.workStatus,
    deliveryDate: q.deliveryDate ? q.deliveryDate.toISOString().slice(0, 10) : null,
    customer: q.customer?.name || "",
    customerPhone: q.customer?.phone || "",
    items: q.items.map((it) => ({
      id: it.id,
      categoryId: it.categoryId,
      description: it.description,
      quantity: it.quantity,
      specs: specRows(it.details, catalog),
      hasPipeline: it.tasks.length > 0,
      tasks: it.tasks.map((t) => ({
        id: t.id, stage: t.stage, workerId: t.workerId,
        workerName: t.worker?.name || "", workerColor: t.worker?.color || "",
        done: !!t.doneAt,
        doneAt: t.doneAt ? t.doneAt.toISOString() : null,
      })),
    })),
  }));

  const stations = config.stations.map((s) => ({
    ...s,
    mainWorkerName: s.mainWorkerId ? workerName.get(s.mainWorkerId) || "" : "",
    subNames: s.subWorkerIds.map((id) => workerName.get(id) || "").filter(Boolean),
  }));

  return { quotes: mappedQuotes, workers, categories, stations, pipelines: config.pipelines, defaultPipeline: config.defaultPipeline };
}

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

  // Attendance is now per shift (morning/evening). Key by worker+period.
  const attByKey = new Map(attendance.map((a) => [`${a.workerId}:${a.period}`, a]));
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
    // Per-shift status (unset shift defaults to "present", matching the old
    // behaviour where a missing record meant present).
    am: attByKey.get(`${w.id}:morning`)?.status || "present",
    pm: attByKey.get(`${w.id}:evening`)?.status || "present",
    amNote: attByKey.get(`${w.id}:morning`)?.note || "",
    pmNote: attByKey.get(`${w.id}:evening`)?.note || "",
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
    const dayStr = (d: Date) => d.toISOString().slice(0, 10);
    const presentDays = new Set(att.filter((a) => a.status !== "absent").map((a) => dayStr(a.date)));
    const absentDays = new Set(att.filter((a) => a.status === "absent").map((a) => dayStr(a.date)));
    return {
      workerId: w.id, name: w.name,
      tasksDone: tasks.length,
      installs: installs.length,
      // Day-level (a day counts present if any shift was present).
      daysPresent: presentDays.size,
      daysAbsent: absentDays.size,
      // Shift-level absence detail.
      amAbsent: att.filter((a) => a.period === "morning" && a.status === "absent").length,
      pmAbsent: att.filter((a) => a.period === "evening" && a.status === "absent").length,
      installLog: installs.map((m) => ({ date: m.crew.date.toISOString().slice(0, 10), quote: m.crew.quotation?.quoteNumber || "" })),
    };
  });

  // Per-stage / per-section breakdown: how many pieces were completed at each
  // stage in the range (station name == stage name, so this doubles as the
  // section productivity view).
  const stageMap = new Map<string, number>();
  for (const d of done) stageMap.set(d.stage, (stageMap.get(d.stage) || 0) + 1);
  const byStage = [...stageMap.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  return { from: fromStr, to: toStr, rows, byStage };
}
