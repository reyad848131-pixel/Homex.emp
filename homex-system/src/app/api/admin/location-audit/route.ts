import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";

// OWNER-ONLY, PASSWORD-GATED diagnostic (read-only). Restricted to the owner
// (civil id 2016) AND a private passcode that only he sets — so even on his own
// signed-in device nobody else can open it. First submission sets the passcode.
//
// It proves today's per-order location change did not move any existing order's
// location: it counts/lists the orders that carry a NEW per-order snapshot
// (created/edited today) vs. the rest that still show the customer's location
// unchanged, and confirms the frozen board-entry month is filled everywhere.
const OWNER_CIVIL_ID = "2016";
const PASS_KEY = "owner_audit_pass_hash";

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { civilId?: string };
  if (user.civilId !== OWNER_CIVIL_ID) {
    return NextResponse.json({ error: "هذه الصفحة خاصة بالمالك فقط" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const passcode = String(body.passcode || "").trim();
  if (passcode.length < 4) {
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 4 خانات على الأقل" }, { status: 400 });
  }

  // First time: whatever is entered becomes the private passcode. Afterwards it
  // must match. Change it later via { passcode (current), newPasscode }.
  const hash = await getSetting(PASS_KEY, "");
  let firstTime = false;
  if (!hash) {
    await setSetting(PASS_KEY, await bcrypt.hash(passcode, 10));
    firstTime = true;
  } else {
    const ok = await bcrypt.compare(passcode, hash);
    if (!ok) return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    const newPass = String(body.newPasscode || "").trim();
    if (newPass && newPass.length >= 4) {
      await setSetting(PASS_KEY, await bcrypt.hash(newPass, 10));
    }
  }

  const onBoard = { deliveryDate: { not: null } };
  const hasSnapshot = { OR: [{ governorate: { not: null } }, { wilayat: { not: null } }] };

  const [boardTotal, snapshotCount, boardMonthNull, withSnapshot] = await Promise.all([
    prisma.quotation.count({ where: onBoard }),
    prisma.quotation.count({ where: { ...onBoard, ...hasSnapshot } }),
    prisma.quotation.count({ where: { ...onBoard, boardMonth: null } }),
    prisma.quotation.findMany({
      where: hasSnapshot,
      select: {
        quoteNumber: true, createdAt: true, governorate: true, wilayat: true, address: true,
        customer: { select: { name: true, governorate: true, wilayat: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const unchanged = boardTotal - snapshotCount;
  return NextResponse.json({
    firstTime,
    summary: snapshotCount === 0
      ? `كل الطلبات (${boardTotal}) تعرض موقع العميل بدون أي تغيير عن السابق — ما في ولا طلب تأثّر.`
      : `${unchanged} من ${boardTotal} طلب تعرض موقع العميل بدون تغيير. فقط ${snapshotCount} طلب لها موقع خاص (أُنشئت/عُدّلت حديثاً) — راجع القائمة وتأكد إنها طلباتك الجديدة فقط.`,
    boardTotal,
    snapshotCount,
    unchanged,
    boardMonthNull,
    boardMonthNote: boardMonthNull === 0
      ? "كل الطلبات لها شهر دخول ثابت (تمت التهيئة)."
      : `${boardMonthNull} طلب بدون شهر دخول بعد — يُملأ تلقائياً أول ما تُفتح إدارة الأعمال.`,
    snapshotList: withSnapshot.map((q) => ({
      quoteNumber: q.quoteNumber,
      customer: q.customer?.name || "",
      createdAt: q.createdAt,
      quoteLocation: [q.governorate, q.wilayat].filter(Boolean).join(" – ") || "—",
      customerLocation: [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ") || "—",
    })),
  });
}
