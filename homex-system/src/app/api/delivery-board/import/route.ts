import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { boardEditorId, canEditBoard } from "@/lib/delivery-board";
import { normalizeCredential } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bulk-import customers onto the delivery board from an Excel file. This is the
// PREVIEW step (no writes): it parses the sheet, matches every row to a real
// quotation (by quote number, else phone, else a UNIQUE name), and reports what
// would happen so the editor can confirm before anything is added.

function findCol(headers: string[], keys: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || "").toString().toLowerCase();
    if (keys.some((k) => h.includes(k))) return i;
  }
  return -1;
}

// Parse a cell into an ISO date. Accepts a real Excel date, or text like
// dd/mm/yyyy or dd/mm (year filled from `defaultYear`).
function parseDate(v: unknown, defaultYear: number): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = /^(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?$/.exec(s);
  if (m) {
    const day = parseInt(m[1], 10), mon = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : defaultYear;
    if (year < 100) year += 2000;
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    if (!canEditBoard(user.role, user.id, await boardEditorId())) {
      return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const defaultYear = parseInt(String(form.get("year") || ""), 10) || new Date().getFullYear();
    if (!(file instanceof Blob)) return NextResponse.json({ error: "لم يُرفع ملف" }, { status: 400 });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });

    // Header row = the first non-empty row.
    let headerRowIdx = 1;
    for (let i = 1; i <= ws.rowCount; i++) { if (ws.getRow(i).actualCellCount > 0) { headerRowIdx = i; break; } }
    const headers: string[] = [];
    ws.getRow(headerRowIdx).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? "").trim(); });

    const idCol = findCol(headers, ["كوتيشن", "رقم العرض", "العرض", "number", "quote", "رقم"]);
    const phoneCol = findCol(headers, ["هاتف", "جوال", "phone", "mobile", "رقم الهاتف"]);
    const nameCol = findCol(headers, ["عميل", "اسم", "customer", "name", "الزبون"]);
    const dateCol = findCol(headers, ["تاريخ", "date", "يوم التوصيل", "التوصيل"]);
    if (idCol < 0 && phoneCol < 0 && nameCol < 0) {
      return NextResponse.json({ error: "ما لقيت عمود للعميل — لازم عمود: رقم الكوتيشن أو الهاتف أو الاسم" }, { status: 400 });
    }

    const cell = (row: ExcelJS.Row, idx: number) => (idx >= 0 ? (row.getCell(idx + 1).value ?? "") : "");
    const rows: any[] = [];
    for (let i = headerRowIdx + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      if (row.actualCellCount === 0) continue;
      const idV = String(cell(row, idCol) || "").trim();
      const phoneV = normalizeCredential(String(cell(row, phoneCol) || ""));
      const nameV = String(cell(row, nameCol) || "").trim();
      const dateISO = parseDate(cell(row, dateCol), defaultYear);
      if (!idV && !phoneV && !nameV) continue;

      let match: { id: string; quoteNumber: string; customerName: string } | null = null;
      let status = "notfound";

      if (idV) {
        const norm = normalizeCredential(idV);
        const q = await prisma.quotation.findFirst({
          where: { OR: [{ quoteNumber: { contains: norm, mode: "insensitive" } }, { originalNumber: { contains: norm, mode: "insensitive" } }] },
          select: { id: true, quoteNumber: true, customer: { select: { name: true } } },
        });
        if (q) { match = { id: q.id, quoteNumber: q.quoteNumber, customerName: q.customer?.name || "" }; status = "matched"; }
      }
      if (!match && phoneV) {
        const list = await prisma.quotation.findMany({ where: { customer: { phone: { contains: phoneV } } }, select: { id: true, quoteNumber: true, customer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 2 });
        if (list.length === 1) { match = { id: list[0].id, quoteNumber: list[0].quoteNumber, customerName: list[0].customer?.name || "" }; status = "matched"; }
        else if (list.length > 1) status = "ambiguous";
      }
      if (!match && status !== "ambiguous" && nameV) {
        const list = await prisma.quotation.findMany({ where: { customer: { name: { contains: nameV, mode: "insensitive" } } }, select: { id: true, quoteNumber: true, customer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 3 });
        if (list.length === 1) { match = { id: list[0].id, quoteNumber: list[0].quoteNumber, customerName: list[0].customer?.name || "" }; status = "matched"; }
        else if (list.length > 1) status = "ambiguous";
      }

      rows.push({
        input: idV || nameV || phoneV,
        date: dateISO,
        id: match?.id || null,
        quoteNumber: match?.quoteNumber || "",
        customerName: match?.customerName || "",
        status: !dateISO && match ? "nodate" : status,
      });
    }

    const s = await getSettings().catch(() => ({} as Record<string, string>));
    return NextResponse.json({
      rows,
      summary: {
        total: rows.length,
        matched: rows.filter((r) => r.status === "matched").length,
        ambiguous: rows.filter((r) => r.status === "ambiguous").length,
        notfound: rows.filter((r) => r.status === "notfound").length,
        nodate: rows.filter((r) => r.status === "nodate").length,
      },
      company: s.company_name || "Homex",
    });
  } catch (e) {
    console.error("API error [/api/delivery-board/import]:", e);
    return NextResponse.json({ error: "تعذّر قراءة الملف", detail: (e as Error)?.message }, { status: 500 });
  }
}
