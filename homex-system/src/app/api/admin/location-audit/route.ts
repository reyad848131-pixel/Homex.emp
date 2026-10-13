import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// READ-ONLY diagnostic (admin/ceo only): proves today's per-order location
// change did not silently move any existing order's location. Logic:
//   • governorate/wilayat/address on a quotation are the NEW per-order snapshot.
//   • They are only ever written on NEW creation / edit-save (today onward) and
//     cleared on reassign — so every order created BEFORE today has them NULL.
//   • applyQuoteLocation() overrides the displayed location ONLY when the quote
//     has a snapshot; with no snapshot it shows the customer's location, exactly
//     as before. Therefore any order WITHOUT a snapshot is unchanged from before.
// This endpoint simply counts/lists the orders that DO carry a snapshot so you
// can confirm they are only the ones intentionally created/edited today.
export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { role: string };
  if (!(user.role === "admin" || user.role === "ceo")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    الخلاصة: snapshotCount === 0
      ? `كل الطلبات (${boardTotal}) تعرض موقع العميل بدون أي تغيير عن السابق — ما في ولا طلب تأثّر.`
      : `${unchanged} من ${boardTotal} طلب تعرض موقع العميل بدون تغيير. فقط ${snapshotCount} طلب لها موقع خاص (أُنشئت/عُدّلت حديثاً) — راجع القائمة أدناه وتأكد إنها طلباتك الجديدة فقط.`,
    إجمالي_الطلبات_على_اللوح: boardTotal,
    طلبات_بموقع_خاص_جديد: snapshotCount,
    طلبات_بدون_تغيير: unchanged,
    طلبات_شهر_اللوح_فارغ: boardMonthNull,
    ملاحظة_شهر_اللوح: boardMonthNull === 0
      ? "كل الطلبات لها شهر دخول ثابت (backfill تم)."
      : `${boardMonthNull} طلب بدون شهر دخول بعد — يُملأ تلقائياً أول ما تُفتح إدارة الأعمال.`,
    قائمة_الطلبات_بموقع_خاص: withSnapshot.map((q) => ({
      العرض: q.quoteNumber,
      العميل: q.customer?.name || "",
      تاريخ_الإنشاء: q.createdAt,
      موقع_العرض: [q.governorate, q.wilayat].filter(Boolean).join(" – ") || "—",
      موقع_العميل_المحفوظ: [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ") || "—",
    })),
  });
}
