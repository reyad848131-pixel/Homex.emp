import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import {
  parseWorkbook, mapRow, autoMapHeaders, guessWorkStatus, IMPORT_FIELDS,
  type ImportField, type MappedRow,
} from "@/lib/import";
import { VALID_WORK_STATUSES } from "@/lib/types";

function adminOnly(user: any) {
  return user?.role === "admin" || user?.role === "ceo";
}

interface Payload {
  action: "preview" | "commit";
  mapping?: Partial<Record<ImportField, string>>;
  statusMap?: Record<string, string>; // raw work-status text → system work status
  years?: number[] | null;            // only import rows whose delivery year is in this set (null/empty = all)
  includeUndated?: boolean;           // also include rows that have no readable date (in-progress orders)
  undatedStatus?: string;             // forced work status for rows with no date
  defaultWorkStatus?: string;          // fallback when a raw status isn't mapped
  headerRow?: number;                  // 1-based header row (auto-detected when omitted)
}

const DELIVERED = "delivered";

export async function GET() {
  // List recent import batches so the UI can offer an "undo".
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!adminOnly(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = (await prisma.$queryRaw`
      SELECT import_batch AS batch, COUNT(*)::int AS count, MIN(created_at) AS at
      FROM quotations WHERE import_batch IS NOT NULL
      GROUP BY import_batch ORDER BY MIN(created_at) DESC LIMIT 20
    `) as Array<{ batch: string; count: number; at: Date }>;
    return NextResponse.json({ batches: rows });
  } catch (e) {
    console.error("API error [/api/import GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!adminOnly(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const payload: Payload = JSON.parse((form.get("payload") as string) || "{}");
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows, headerRow } = await parseWorkbook(buffer, payload.headerRow);
    // Auto-map by header name, then let any explicit user overrides win. An
    // override to "" (—) clears an auto-mapped field.
    const mapping = { ...autoMapHeaders(headers), ...(payload.mapping || {}) } as Record<ImportField, string>;

    const mapped = rows.map((r, i) => mapRow(r, i + 2, mapping)); // +2: header is row 1
    const years = (payload.years || []).filter((y) => Number.isFinite(y));
    const yearSet = new Set(years);
    const includeUndated = !!payload.includeUndated;
    const inYear = yearSet.size === 0
      ? mapped
      : mapped.filter((m) => (m.year != null && yearSet.has(m.year)) || (includeUndated && m.year == null));

    // Distinct raw work-status values (for the mapping UI).
    const statusCounts = new Map<string, number>();
    for (const m of inYear) {
      const key = m.workStatusRaw || "(فارغ)";
      statusCounts.set(key, (statusCounts.get(key) || 0) + 1);
    }
    const distinctStatuses = [...statusCounts.entries()]
      .map(([raw, count]) => ({ raw, count }))
      .sort((a, b) => b.count - a.count);

    // Auto-classify each distinct raw status (typo-tolerant), then let any
    // explicit user overrides win. This is what makes the mapping "ready on the
    // fly" without manual work.
    const autoStatus: Record<string, string> = {};
    for (const { raw } of distinctStatuses) autoStatus[raw] = guessWorkStatus(raw === "(فارغ)" ? "" : raw);
    const statusMap = { ...autoStatus, ...(payload.statusMap || {}) };
    const undatedStatus = payload.undatedStatus && VALID_WORK_STATUSES.includes(payload.undatedStatus)
      ? payload.undatedStatus : null;
    const resolveStatus = (m: MappedRow) => {
      // Rows with no date get the admin-chosen status (e.g. delivered).
      if (m.year == null && undatedStatus) return undatedStatus;
      const val = statusMap[m.workStatusRaw || "(فارغ)"];
      return val && VALID_WORK_STATUSES.includes(val) ? val : guessWorkStatus(m.workStatusRaw);
    };

    // Duplicate order numbers: within the file and against existing quotations.
    const seen = new Set<string>();
    const fileDups = new Set<string>();
    for (const m of inYear) {
      if (!m.orderNumber) continue;
      if (seen.has(m.orderNumber)) fileDups.add(m.orderNumber);
      seen.add(m.orderNumber);
    }
    const existingNums = new Set<string>(
      seen.size
        ? (await prisma.quotation.findMany({
            where: { quoteNumber: { in: [...seen] } },
            select: { quoteNumber: true },
          })).map((q) => q.quoteNumber)
        : []
    );

    const evaluate = (m: MappedRow) => {
      const errs = [...m.errors];
      if (m.orderNumber && existingNums.has(m.orderNumber)) errs.push("order_number_exists");
      return errs;
    };

    if (payload.action === "preview") {
      const valid = inYear.filter((m) => evaluate(m).length === 0);
      // Rows with no readable date at all (neither delivery nor booking) can't
      // be placed in a year, so they're excluded when a year filter is set.
      // Surfaced so the admin notices instead of silently losing them.
      const noDateRows = mapped.filter((m) => m.year == null).length;
      return NextResponse.json({
        headers,
        headerRow,
        mapping,
        totalRows: mapped.length,
        yearRows: inYear.length,
        validCount: valid.length,
        errorCount: inYear.length - valid.length,
        noDateRows,
        statusMap,
        distinctStatuses,
        fileDuplicates: [...fileDups],
        sample: inYear.slice(0, 25).map((m) => ({
          rowNumber: m.rowNumber,
          orderNumber: m.orderNumber,
          name: m.name,
          phone: m.phone,
          place: m.place,
          total: m.total,
          advance: m.advance,
          deliveryDate: m.deliveryDate ? m.deliveryDate.toISOString() : null,
          workStatusRaw: m.workStatusRaw,
          systemWorkStatus: resolveStatus(m),
          errors: evaluate(m),
        })),
      });
    }

    // ---- COMMIT (bulk, so hundreds of rows import in a few queries instead of
    // hundreds of sequential round-trips that could time out) ----
    const batchId = `imp_${Date.now().toString(36)}`;
    const skipped: Array<{ row: number; order: string; reason: string }> = [];
    const usedNums = new Set(existingNums);

    // 1) Decide which rows to create and assign a unique quote number to each.
    const toCreate: Array<{ m: MappedRow; quoteNumber: string; suffixed: boolean }> = [];
    for (const m of inYear) {
      if (m.errors.length) { skipped.push({ row: m.rowNumber, order: m.orderNumber || "-", reason: m.errors[0] }); continue; }
      if (existingNums.has(m.orderNumber)) { skipped.push({ row: m.rowNumber, order: m.orderNumber, reason: "order_number_exists" }); continue; }
      let quoteNumber = m.orderNumber;
      if (usedNums.has(quoteNumber)) {
        let i = 2;
        while (usedNums.has(`${m.orderNumber}-${i}`)) i++;
        quoteNumber = `${m.orderNumber}-${i}`;
      }
      usedNums.add(quoteNumber);
      toCreate.push({ m, quoteNumber, suffixed: quoteNumber !== m.orderNumber });
    }

    // 2) Customers — match existing by phone in one query, bulk-create the rest.
    const phones = [...new Set(toCreate.map((x) => x.m.phone))];
    const custByPhone = new Map<string, string>();
    if (phones.length) {
      const existingCust = await prisma.customer.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true } });
      for (const c of existingCust) if (!custByPhone.has(c.phone)) custByPhone.set(c.phone, c.id);
    }
    const newPhones = phones.filter((p) => !custByPhone.has(p));
    if (newPhones.length) {
      const firstByPhone = new Map<string, MappedRow>();
      for (const x of toCreate) if (newPhones.includes(x.m.phone) && !firstByPhone.has(x.m.phone)) firstByPhone.set(x.m.phone, x.m);
      await prisma.customer.createMany({
        data: newPhones.map((p) => {
          const m = firstByPhone.get(p)!;
          return { name: m.name, phone: p, phoneCode: "+968", governorate: m.place || "-", wilayat: m.place || "-", createdBy: user.id, importBatch: batchId };
        }),
      });
      const createdCust = await prisma.customer.findMany({ where: { importBatch: batchId, phone: { in: newPhones } }, select: { id: true, phone: true } });
      for (const c of createdCust) if (!custByPhone.has(c.phone)) custByPhone.set(c.phone, c.id);
    }

    // 3) Bulk-create the quotations.
    const quoteData = toCreate.map(({ m, quoteNumber, suffixed }) => {
      const workStatus = resolveStatus(m);
      const notes = [m.description, m.remarks, suffixed ? `رقم أصلي: ${m.orderNumber}` : ""].filter(Boolean).join(" — ") || null;
      return {
        quoteNumber,
        customerId: custByPhone.get(m.phone)!,
        employeeId: user.id,
        status: "accepted",
        total: m.total,
        workStatus,
        deliveryDate: m.deliveryDate,
        deliveredAt: workStatus === DELIVERED ? (m.deliveredOn || m.deliveryDate) : null,
        createdAt: (m.bookingDate || m.deliveryDate) ?? undefined,
        workNotes: notes,
        importBatch: batchId,
      };
    }).filter((q) => q.customerId);
    const createRes = await prisma.quotation.createMany({ data: quoteData, skipDuplicates: true });
    const created = createRes.count;

    // 4) Bulk-create the advance payments (look up the new quotation ids once).
    const advanceRows = toCreate.filter((x) => x.m.advance > 0);
    if (advanceRows.length) {
      const createdQuotes = await prisma.quotation.findMany({ where: { importBatch: batchId }, select: { id: true, quoteNumber: true } });
      const idByNum = new Map(createdQuotes.map((q) => [q.quoteNumber, q.id]));
      const payData = advanceRows
        .map((x) => ({ quotationId: idByNum.get(x.quoteNumber)!, amount: x.m.advance, method: "cash", notes: "استيراد — دفعة مقدمة", recordedBy: user.id }))
        .filter((p) => p.quotationId);
      if (payData.length) await prisma.payment.createMany({ data: payData });
    }

    // Breakdown of skip reasons so the admin can see exactly what happened.
    const reasonCounts: Record<string, number> = {};
    for (const s of skipped) reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;

    await logAction(user.id, "import", "quotation", batchId, JSON.stringify({ created, skipped: skipped.length, reasonCounts }));
    return NextResponse.json({ batchId, created, skippedCount: skipped.length, reasonCounts, skipped: skipped.slice(0, 200) });
  } catch (e) {
    console.error("API error [/api/import POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Undo a whole import batch (hard delete of its quotations + customers).
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!adminOnly(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const batch = new URL(req.url).searchParams.get("batch");
    if (!batch) return NextResponse.json({ error: "Missing batch" }, { status: 400 });

    // Delete quotations first (payments/items cascade), then the customers this
    // batch created. Deleting customers is best-effort: any that gained other
    // quotations later can't be removed (FK) and are simply left in place.
    const delQuotes = await prisma.quotation.deleteMany({ where: { importBatch: batch } as any });
    let delCustCount = 0;
    try {
      const delCust = await prisma.customer.deleteMany({ where: { importBatch: batch } as any });
      delCustCount = delCust.count;
    } catch {
      // Fall back to deleting only customers that have no remaining quotations.
      const batchCust = await prisma.customer.findMany({ where: { importBatch: batch } as any, select: { id: true } });
      for (const c of batchCust) {
        const remaining = await prisma.quotation.count({ where: { customerId: c.id } });
        if (remaining === 0) {
          try { await prisma.customer.delete({ where: { id: c.id } }); delCustCount++; } catch { /* skip */ }
        }
      }
    }

    await logAction(user.id, "import_undo", "quotation", batch, JSON.stringify({ quotations: delQuotes.count, customers: delCustCount }));
    return NextResponse.json({ ok: true, quotations: delQuotes.count, customers: delCustCount });
  } catch (e) {
    console.error("API error [/api/import DELETE]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const IMPORT_FIELD_LIST = IMPORT_FIELDS;
