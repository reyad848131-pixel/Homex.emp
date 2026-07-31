import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";

function adminOnly(user: any) {
  return user?.role === "admin" || user?.role === "ceo";
}

// Same private passcode gate as the rest of the import area.
async function checkPasscode(req: NextRequest): Promise<NextResponse | null> {
  const hash = await getSetting("import_passcode", "");
  if (!hash) return null;
  const provided = req.headers.get("x-import-passcode") || "";
  const ok = provided && (await bcrypt.compare(provided, hash));
  if (!ok) return NextResponse.json({ error: "كلمة سر الاستيراد مطلوبة", code: "passcode" }, { status: 403 });
  return null;
}

// Renumber a whole import batch into the unified HX-YYYY-#### format, keeping
// each order's previous number as originalNumber. The old imported numbers
// (SW-###) become a searchable reference, and the batch joins the unified
// yearly series. Only the batch's active (non-trashed) orders are touched.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!adminOnly(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const gate = await checkPasscode(req); if (gate) return gate;

    const body = await req.json();
    const batch = String(body?.batch || "");
    if (!batch) return NextResponse.json({ error: "Missing batch" }, { status: 400 });

    const rows = await prisma.quotation.findMany({
      where: { importBatch: batch },
      select: { id: true, quoteNumber: true, deliveryDate: true },
    });
    if (rows.length === 0) return NextResponse.json({ error: "لا توجد طلبات في هذه الدفعة" }, { status: 404 });

    // Year for the whole batch = the most common delivery year (fallback: now).
    const yearCounts = new Map<number, number>();
    for (const r of rows) {
      if (r.deliveryDate) {
        const y = new Date(r.deliveryDate).getUTCFullYear();
        yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
      }
    }
    let year = new Date().getFullYear();
    let best = 0;
    for (const [y, c] of yearCounts) if (c > best) { best = c; year = y; }

    // Order chronologically (undated last), then by the current number.
    rows.sort((a, b) => {
      const da = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
      const db = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
      if (da !== db) return da - db;
      return a.quoteNumber.localeCompare(b.quoteNumber, undefined, { numeric: true });
    });

    const ids = rows.map((r) => r.id);
    const pad = (n: number) => `HX-${year}-${String(n).padStart(4, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      // Phase 1: preserve the original number once, then park every target row
      // on a guaranteed-unique temporary value so the final assignment can't hit
      // the unique constraint mid-flight.
      await tx.$executeRaw(Prisma.sql`
        UPDATE quotations SET original_number = quote_number
        WHERE id IN (${Prisma.join(ids)}) AND original_number IS NULL
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE quotations SET quote_number = '__RN_' || id
        WHERE id IN (${Prisma.join(ids)})
      `);

      // HX-YYYY-#### numbers used by rows OUTSIDE this batch (now that the batch
      // rows are parked on temps) — skip them to avoid collisions.
      const ext = (await tx.$queryRaw(Prisma.sql`
        SELECT quote_number FROM quotations WHERE quote_number LIKE ${`HX-${year}-%`}
      `)) as Array<{ quote_number: string }>;
      const used = new Set(ext.map((e) => e.quote_number));

      // Assign the final sequential numbers, skipping any already used.
      let seq = 1;
      const tuples: Prisma.Sql[] = [];
      for (const r of rows) {
        while (used.has(pad(seq))) seq++;
        const fn = pad(seq);
        used.add(fn);
        seq++;
        tuples.push(Prisma.sql`(${r.id}, ${fn})`);
      }
      await tx.$executeRaw(Prisma.sql`
        UPDATE quotations AS q SET quote_number = v.num
        FROM (VALUES ${Prisma.join(tuples)}) AS v(id, num)
        WHERE q.id = v.id
      `);

      return { count: rows.length, first: pad(1), year };
    });

    await logAction(user.id, "renumber", "quotation", batch, JSON.stringify({ count: result.count, year: result.year }));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("API error [/api/import/renumber]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
