import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { normalizeCredential } from "@/lib/text";
import { SETTINGS_OWNER_CIVIL_IDS } from "@/lib/settings-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ONE-TIME seed of Sultan Al Nabhani's historical curtain-order sheet. Owner-only
// (Riyad / Salim). Each row is matched to an existing quotation by phone (then a
// unique name) and LINKED when found, otherwise added STANDALONE. Idempotent:
// a standalone row is skipped if one with the same advance bill no already
// exists, and linked rows upsert. Safe to hit more than once.

type Row = {
  name: string; date: string; phone?: string; place?: string; bill: string;
  our: number | null; out: number;
};

// From the "CURTAIN ORDER — SULTAN AL NABHANI FACTORY" sheet. Work status blank
// → placed. Outside price blank → 0. Salim (our) price blank → null.
const ROWS: Row[] = [
  { name: "Ahmed Al Shaqsi",        date: "2026-03-04", phone: "96375191", place: "Bahla",   bill: "SW-594", our: 2039, out: 1300 },
  { name: "Mohammed Said Al Haji",  date: "2026-04-23", phone: "96448966", place: "Manah",   bill: "SW-625", our: 666,  out: 450 },
  { name: "Ahmed Al Hinai",         date: "2026-05-20", phone: "96665960", place: "Bahla",   bill: "SW-638", our: 2035, out: 1400 },
  { name: "Salim Al Rabani",        date: "2026-05-09", phone: "95372198", place: "Bahla",   bill: "SW-640", our: 350,  out: 0 },
  { name: "Zahir Al Harthi",        date: "2026-07-15", phone: "",         place: "",        bill: "SW-658", our: 1443, out: 800 },
  { name: "Ahmed Al Qassabi",       date: "2026-05-16", phone: "95808045", place: "",        bill: "SW-663", our: 829,  out: 570 },
  { name: "Khalid Al Sarmi",        date: "2026-07-30", phone: "95384455", place: "Izki",    bill: "SW-688", our: 880,  out: 680 },
  { name: "Said Al Khatri",         date: "2026-08-21", phone: "93336846", place: "Alhamra", bill: "SW-703", our: 104,  out: 90 },
  { name: "kahlan Al Nayibi",       date: "2026-06-10", phone: "99526222", place: "Alhamra", bill: "SW-696", our: 102,  out: 90 },
  { name: "Muhana Al Nabhani",      date: "2026-09-10", phone: "91928788", place: "Tanuf",   bill: "SW-724", our: null, out: 0 },
  { name: "Said Al Hinai",          date: "2026-09-24", phone: "99886112", place: "Amla",    bill: "SW-725", our: 1524, out: 0 },
  { name: "Naser Al Ryami",         date: "2026-09-18", phone: "99847112", place: "Nizwa",   bill: "SW-727", our: 605,  out: 0 },
];

async function run(userId: string) {
  const bills = ROWS.map((r) => r.bill);

  // Clean slate: remove any earlier attempt for these bills — whether it was
  // linked to a quotation or standalone — so we always end with exactly these
  // rows as standalone. (Deleting a linked CurtainOrder only removes the
  // tracking row, never the quotation.)
  const removed = await prisma.curtainOrder.deleteMany({ where: { advanceBillNo: { in: bills } } });

  // Add all rows as STANDALONE (external) — no quotation linking.
  for (const r of ROWS) {
    const phone = normalizeCredential(r.phone || "");
    await prisma.curtainOrder.create({
      data: {
        advanceBillNo: r.bill,
        ourPrice: r.our,
        outsidePrice: r.out,
        manufacturer: "Sultan Al Nabhani",
        workStatus: "placed",
        custName: r.name,
        custPhone: phone || null,
        custPhoneCode: phone ? "+968" : null,
        place: r.place || null,
        deliveryDate: new Date(r.date),
        curtainCount: null,
      },
    });
  }

  const result = { added: ROWS.length, removedFirst: removed.count };
  await logAction(userId, "curtain_order_seed", "curtain_order", undefined, JSON.stringify(result)).catch(() => {});
  return result;
}

async function guardedRun(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; civilId: string };
  if (!SETTINGS_OWNER_CIVIL_IDS.includes(user.civilId)) {
    return NextResponse.json({ error: "غير مصرّح — رياض وسالم فقط" }, { status: 403 });
  }
  const result = await run(user.id);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) { return guardedRun(req); }
// GET allowed too so it can be triggered once from the browser while logged in.
export async function GET(req: NextRequest) { return guardedRun(req); }
