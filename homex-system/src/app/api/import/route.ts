import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import {
  parseWorkbook, mapRow, autoMapHeaders, guessWorkStatus, estimateMissingDates, IMPORT_FIELDS,
  type ImportField, type MappedRow,
} from "@/lib/import";
import { VALID_WORK_STATUSES } from "@/lib/types";

function adminOnly(user: any) {
  return user?.role === "admin" || user?.role === "ceo";
}

// If a private import passcode has been set, every import operation requires it
// (sent in the x-import-passcode header) — regardless of role. Returns null when
// allowed, or a NextResponse when blocked.
async function checkPasscode(req: NextRequest): Promise<NextResponse | null> {
  const hash = await getSetting("import_passcode", "");
  if (!hash) return null; // no passcode configured → not gated
  const provided = req.headers.get("x-import-passcode") || "";
  const ok = provided && (await bcrypt.compare(provided, hash));
  if (!ok) return NextResponse.json({ error: "كلمة سر الاستيراد مطلوبة", code: "passcode" }, { status: 403 });
  return null;
}

interface Payload {
  action: "preview" | "commit" | "conflicts";
  mapping?: Partial<Record<ImportField, string>>;
  statusMap?: Record<string, string>; // raw work-status text → system work status
  years?: number[] | null;            // only import rows whose delivery year is in this set (null/empty = all)
  includeUndated?: boolean;           // also include rows that have no readable date (in-progress orders)
  undatedStatus?: string;             // forced work status for rows with no date
  defaultWorkStatus?: string;          // fallback when a raw status isn't mapped
  headerRow?: number;                  // 1-based header row (auto-detected when omitted)
  editableDraft?: boolean;            // import as an editable draft + keep the total as a reference
  sheetName?: string;                  // which worksheet (tab) to read
  autoNumber?: boolean;               // generate a number for rows that have none (instead of skipping)
  importIncomplete?: boolean;         // import every row, filling placeholders for missing name/phone/number
  estimateDates?: boolean;            // estimate missing delivery dates from neighbouring rows (for ordering)
}

const DELIVERED = "delivered";

export async function GET(req: NextRequest) {
  // List recent import batches so the UI can offer an "undo".
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!adminOnly(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const gate = await checkPasscode(req); if (gate) return gate;

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
    const gate = await checkPasscode(req); if (gate) return gate;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const payload: Payload = JSON.parse((form.get("payload") as string) || "{}");
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows, headerRow, sheets, sheetName } = await parseWorkbook(buffer, payload.headerRow, payload.sheetName);
    // Auto-map by header name, then let any explicit user overrides win. An
    // override to "" (—) clears an auto-mapped field.
    const mapping = { ...autoMapHeaders(headers), ...(payload.mapping || {}) } as Record<ImportField, string>;

    const rawMapped = rows.map((r, i) => mapRow(r, i + 2, mapping)); // +2: header is row 1
    // Drop repeated header rows, section banners and monthly TOTAL rows that run
    // through the company's multi-section sheets — they carry enough text to slip
    // in as junk quotations otherwise. Dropped before anything else so they don't
    // skew counts, date estimation, or duplicate detection.
    const mapped = rawMapped.filter((m) => !m.noise);
    const noiseRows = rawMapped.length - mapped.length;
    // Estimate missing delivery dates from neighbouring rows (file order) so
    // undated rows sort into the right chronological place. Runs before the
    // year filter so estimated rows gain a year and are included. Defaults on;
    // the estimate is flagged (deliveryDateEstimated) for manual confirmation.
    if (payload.estimateDates !== false) estimateMissingDates(mapped);
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
      const raw = (m.workStatusRaw || "").trim();
      // Every order keeps its OWN status from the sheet — so each lands in the
      // right place (work board / delivery queue / installed / ...).
      if (raw) {
        const val = statusMap[raw];
        return val && VALID_WORK_STATUSES.includes(val) ? val : guessWorkStatus(raw);
      }
      // Only rows with no status at all fall back to the chosen default.
      if (undatedStatus) return undatedStatus;
      return guessWorkStatus(raw);
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
    // Numbers of quotations sitting in the Trash (soft-deleted). The global read
    // filter hides them from the query above, so fetch them explicitly (the
    // `deletedAt` filter bypasses it). A deleted order must NOT be re-created —
    // the customer deleted it on purpose — so these are skipped just like
    // existing ones, but reported separately so the reason is clear.
    const deletedNums = new Set<string>(
      seen.size
        ? (await prisma.quotation.findMany({
            where: { quoteNumber: { in: [...seen] }, deletedAt: { not: null } },
            select: { quoteNumber: true },
          })).map((q) => q.quoteNumber)
        : []
    );

    // "Import incomplete" imports every row (placeholders for missing fields);
    // auto-numbering just fills a missing order number. Compute which of the
    // per-row errors still block a row.
    const forceAll = !!payload.importIncomplete;
    const autoNumber = !!payload.autoNumber || forceAll;
    const blockingErrors = (m: MappedRow) => m.errors.filter((e) => {
      if (autoNumber && e === "missing_order_number") return false;
      if (forceAll && (e === "missing_name" || e === "missing_phone")) return false;
      return true;
    });
    const evaluate = (m: MappedRow) => {
      const errs = blockingErrors(m);
      if (m.orderNumber && existingNums.has(m.orderNumber)) errs.push("order_number_exists");
      else if (m.orderNumber && deletedNums.has(m.orderNumber)) errs.push("order_in_trash");
      return errs;
    };

    if (payload.action === "conflicts") {
      // Post-import diagnostic: re-read the sheet and find already-imported
      // orders whose linked customer name differs from the name in the sheet
      // row. This happens when an order's phone matched a pre-existing customer
      // (with a different name) at import time — the row's own name was then
      // dropped. Matched by quote number (= the sheet's order number).
      const norm = (s: string) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
      const withNum = mapped.filter((m) => m.orderNumber && m.name);
      const nums = [...new Set(withNum.map((m) => m.orderNumber))];
      const quotes = nums.length
        ? await prisma.quotation.findMany({
            where: { quoteNumber: { in: nums } },
            select: { id: true, quoteNumber: true, deliveryDate: true, customer: { select: { name: true, phone: true } } },
          })
        : [];
      const byNum = new Map(quotes.map((q) => [q.quoteNumber, q]));
      const conflicts: Array<{ id: string; quoteNumber: string; sheetName: string; systemName: string; phone: string; place: string; deliveryDate: string | null }> = [];
      for (const m of withNum) {
        const q = byNum.get(m.orderNumber);
        if (!q) continue; // row not imported (or renumbered) → skip
        if (norm(q.customer.name) !== norm(m.name)) {
          conflicts.push({
            id: q.id,
            quoteNumber: q.quoteNumber,
            sheetName: m.name,
            systemName: q.customer.name,
            phone: m.phone || q.customer.phone,
            place: m.place,
            deliveryDate: (q.deliveryDate || m.deliveryDate)?.toISOString() || null,
          });
        }
      }
      return NextResponse.json({ checked: withNum.length, matched: quotes.length, conflictsCount: conflicts.length, conflicts: conflicts.slice(0, 500) });
    }

    if (payload.action === "preview") {
      const valid = inYear.filter((m) => evaluate(m).length === 0);
      // Rows with no readable date at all (neither delivery nor booking) can't
      // be placed in a year, so they're excluded when a year filter is set.
      // Surfaced so the admin notices instead of silently losing them.
      const noDateRows = mapped.filter((m) => m.year == null).length;
      const estimatedDateRows = inYear.filter((m) => m.deliveryDateEstimated).length;
      // Rows whose order number already exists in the system — a re-import
      // simply SKIPS these (no duplicate, existing quotations untouched). Shown
      // separately from real errors so re-importing to add the missing ones is
      // clearly safe.
      const alreadyExists = inYear.filter((m) => m.orderNumber && existingNums.has(m.orderNumber)).length;
      // Orders whose number is in the Trash — reported so the admin sees they were
      // intentionally left out (a deleted order is never re-created).
      const alreadyInTrash = inYear.filter((m) => m.orderNumber && !existingNums.has(m.orderNumber) && deletedNums.has(m.orderNumber)).length;
      return NextResponse.json({
        headers,
        headerRow,
        sheets,
        sheetName,
        mapping,
        totalRows: mapped.length,
        yearRows: inYear.length,
        validCount: valid.length,
        errorCount: inYear.length - valid.length,
        alreadyExists,
        alreadyInTrash,
        noiseRows,
        noDateRows,
        estimatedDateRows,
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
          deliveryDateEstimated: m.deliveryDateEstimated,
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
    const usedNums = new Set([...existingNums, ...deletedNums]);

    // Generate the next free "IMP-####" number for rows that have none.
    let autoSeq = 1;
    const nextAutoNumber = () => {
      let num: string;
      do { num = `IMP-${String(autoSeq).padStart(4, "0")}`; autoSeq++; } while (usedNums.has(num));
      return num;
    };

    // 1) Decide which rows to create and assign a unique quote number to each.
    const toCreate: Array<{ m: MappedRow; quoteNumber: string; suffixed: boolean }> = [];
    for (const m of inYear) {
      const errs = blockingErrors(m);
      if (errs.length) { skipped.push({ row: m.rowNumber, order: m.orderNumber || "-", reason: errs[0] }); continue; }
      if (m.orderNumber && existingNums.has(m.orderNumber)) { skipped.push({ row: m.rowNumber, order: m.orderNumber, reason: "order_number_exists" }); continue; }
      if (m.orderNumber && deletedNums.has(m.orderNumber)) { skipped.push({ row: m.rowNumber, order: m.orderNumber, reason: "order_in_trash" }); continue; }
      let quoteNumber = m.orderNumber || nextAutoNumber();
      if (m.orderNumber && usedNums.has(quoteNumber)) {
        let i = 2;
        while (usedNums.has(`${m.orderNumber}-${i}`)) i++;
        quoteNumber = `${m.orderNumber}-${i}`;
      }
      usedNums.add(quoteNumber);
      toCreate.push({ m, quoteNumber, suffixed: !!m.orderNumber && quoteNumber !== m.orderNumber });
    }

    // Customer key: real phone groups a customer's orders; a row with no phone
    // gets its own customer (keyed by its quote number) so incomplete orders
    // don't collapse into one. Placeholders fill the missing name/phone.
    const custKey = (m: MappedRow, quoteNumber: string) => m.phone || `#${quoteNumber}`;

    // 2) Customers — match existing by (real) phone, then bulk-create the rest
    // with generated ids (so placeholder-phone customers stay distinct).
    const custByKey = new Map<string, string>();
    const realPhones = [...new Set(toCreate.filter((x) => x.m.phone).map((x) => x.m.phone))];
    if (realPhones.length) {
      const existingCust = await prisma.customer.findMany({ where: { phone: { in: realPhones } }, select: { id: true, phone: true } });
      for (const c of existingCust) if (!custByKey.has(c.phone)) custByKey.set(c.phone, c.id);
    }
    const newCust: Array<{ id: string; key: string; name: string; phone: string; place: string }> = [];
    const seenKey = new Set(custByKey.keys());
    for (const x of toCreate) {
      const key = custKey(x.m, x.quoteNumber);
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      newCust.push({ id: randomUUID(), key, name: x.m.name || "بدون اسم", phone: x.m.phone || "-", place: x.m.place });
    }
    if (newCust.length) {
      await prisma.customer.createMany({
        data: newCust.map((c) => ({ id: c.id, name: c.name, phone: c.phone, phoneCode: "+968", governorate: c.place || "-", wilayat: c.place || "-", createdBy: user.id, importBatch: batchId })),
      });
      for (const c of newCust) custByKey.set(c.key, c.id);
    }

    // 3) Bulk-create the quotations. In "editable draft" mode they come in as a
    // draft (freely editable, not locked) with the sheet total kept as a
    // reference so items can be filled in and checked against it.
    const editableDraft = !!payload.editableDraft;
    const quoteData = toCreate.map(({ m, quoteNumber, suffixed }) => {
      const workStatus = resolveStatus(m);
      const advanceNote = editableDraft && m.advance > 0 ? `دفعة مقدمة (مرجع): ${m.advance.toFixed(3)}` : "";
      const notes = [m.description, m.remarks, suffixed ? `رقم أصلي: ${m.orderNumber}` : "", advanceNote].filter(Boolean).join(" — ") || null;
      return {
        quoteNumber,
        customerId: custByKey.get(custKey(m, quoteNumber))!,
        employeeId: user.id,
        status: editableDraft ? "draft" : "accepted",
        total: m.total,
        importedTotal: editableDraft ? m.total : null,
        workStatus,
        deliveryDate: m.deliveryDate,
        deliveryDateEstimated: m.deliveryDateEstimated,
        deliveredAt: workStatus === DELIVERED ? (m.deliveredOn || m.deliveryDate) : null,
        createdAt: (m.bookingDate || m.deliveryDate) ?? undefined,
        workNotes: notes,
        importBatch: batchId,
      };
    }).filter((q) => q.customerId);
    const createRes = await prisma.quotation.createMany({ data: quoteData, skipDuplicates: true });
    const created = createRes.count;

    // 4) Advance payments. Skipped in editable-draft mode (a payment would lock
    // the quote); the advance is noted in workNotes for reference instead.
    const advanceRows = editableDraft ? [] : toCreate.filter((x) => x.m.advance > 0);
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
    const gate = await checkPasscode(req); if (gate) return gate;

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
