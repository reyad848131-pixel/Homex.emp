import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCredential } from "@/lib/text";
import { parseWorkStatus } from "@/lib/curtain-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PREVIEW step for importing historical curtain orders from Excel. No writes:
// it parses the sheet, tries to match each row to an existing quotation (by
// phone, else a unique name) so it can be LINKED, and otherwise marks it as a
// STANDALONE row. The client shows the preview and posts it back to /apply.

function findCol(headers: string[], keys: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || "").toString().toLowerCase();
    if (keys.some((k) => h.includes(k))) return i;
  }
  return -1;
}

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

const numOr = (v: unknown, fallback: number | null): number | null => {
  if (v == null || v === "") return fallback;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : fallback;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const defaultYear = parseInt(String(form.get("year") || ""), 10) || new Date().getFullYear();
    if (!(file instanceof Blob)) return NextResponse.json({ error: "لم يُرفع ملف" }, { status: 400 });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });

    let headerRowIdx = 1;
    for (let i = 1; i <= ws.rowCount; i++) { if (ws.getRow(i).actualCellCount > 0) { headerRowIdx = i; break; } }
    const headers: string[] = [];
    ws.getRow(headerRowIdx).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? "").trim(); });

    const nameCol = findCol(headers, ["عميل", "اسم", "customer", "name", "الزبون"]);
    const phoneCol = findCol(headers, ["هاتف", "جوال", "phone", "mobile", "رقم"]);
    const placeCol = findCol(headers, ["مكان", "منطقة", "place", "location", "عنوان", "المكان"]);
    const dateCol = findCol(headers, ["تاريخ", "date", "التوصيل"]);
    const billCol = findCol(headers, ["سند", "دفعة", "advance", "bill", "sw"]);
    const ourCol = findCol(headers, ["سعرنا", "salim", "سالم", "our", "بيع"]);
    const outCol = findCol(headers, ["مورد", "مورّد", "outside", "خارج", "تكلفة", "شراء"]);
    const mfrCol = findCol(headers, ["مصنع", "مصنّع", "manufactur", "factory", "workshop", "ورشة"]);
    const statusCol = findCol(headers, ["حالة", "status", "الحالة"]);
    const countCol = findCol(headers, ["عدد", "count", "qty", "كمية", "الستائر"]);

    if (nameCol < 0 && phoneCol < 0) {
      return NextResponse.json({ error: "ما لقيت عمود للاسم أو الهاتف — لازم عمود واحد منهم على الأقل" }, { status: 400 });
    }

    const cell = (row: ExcelJS.Row, idx: number) => (idx >= 0 ? (row.getCell(idx + 1).value ?? "") : "");
    const rows: any[] = [];
    for (let i = headerRowIdx + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      if (row.actualCellCount === 0) continue;
      const nameV = String(cell(row, nameCol) || "").trim();
      const phoneV = normalizeCredential(String(cell(row, phoneCol) || ""));
      if (!nameV && !phoneV) continue;

      const ourPrice = numOr(cell(row, ourCol), null);
      const outsidePrice = numOr(cell(row, outCol), 0) ?? 0;
      const parsed = {
        name: nameV,
        phone: phoneV,
        place: String(cell(row, placeCol) || "").trim(),
        date: parseDate(cell(row, dateCol), defaultYear),
        advanceBillNo: String(cell(row, billCol) || "").trim(),
        ourPrice,
        outsidePrice,
        manufacturer: String(cell(row, mfrCol) || "").trim(),
        workStatus: parseWorkStatus(cell(row, statusCol)),
        curtainCount: countCol >= 0 ? (numOr(cell(row, countCol), null)) : null,
      };

      // Try to link to an existing quotation (phone first, then a unique name).
      let matchId: string | null = null;
      let matchNumber = "";
      let status: "linked" | "standalone" | "ambiguous" = "standalone";
      if (phoneV) {
        const list = await prisma.quotation.findMany({ where: { customer: { phone: { contains: phoneV } } }, select: { id: true, quoteNumber: true }, orderBy: { createdAt: "desc" }, take: 2 });
        if (list.length === 1) { matchId = list[0].id; matchNumber = list[0].quoteNumber; status = "linked"; }
        else if (list.length > 1) status = "ambiguous";
      }
      if (!matchId && status !== "ambiguous" && nameV) {
        const list = await prisma.quotation.findMany({ where: { customer: { name: { contains: nameV, mode: "insensitive" } } }, select: { id: true, quoteNumber: true }, orderBy: { createdAt: "desc" }, take: 2 });
        if (list.length === 1) { matchId = list[0].id; matchNumber = list[0].quoteNumber; status = "linked"; }
        else if (list.length > 1) status = "ambiguous";
      }
      // An ambiguous match still imports — as a standalone row (safer than
      // linking to the wrong quotation).
      const finalStatus = status === "linked" ? "linked" : "standalone";

      rows.push({ ...parsed, quotationId: matchId, quoteNumber: matchNumber, status: finalStatus, ambiguous: status === "ambiguous" });
    }

    const summary = {
      total: rows.length,
      linked: rows.filter((r) => r.status === "linked").length,
      standalone: rows.filter((r) => r.status === "standalone").length,
    };
    return NextResponse.json({ rows, summary });
  } catch (e) {
    console.error("API error [/api/curtain-orders/import]:", e);
    return NextResponse.json({ error: "تعذّر قراءة الملف" }, { status: 500 });
  }
}
