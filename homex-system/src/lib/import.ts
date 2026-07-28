import ExcelJS from "exceljs";

// === Excel import helpers =================================================
// Parses the company's old delivery-schedule spreadsheet and turns each row
// into a normalized record ready to become a Customer + Quotation. The column
// names below are the defaults from that sheet; the import page lets the admin
// remap any of them, so this stays tolerant of small header differences.

export const IMPORT_FIELDS = [
  "orderNumber", // becomes the quote number (kept from the old sheet)
  "name",        // customer name
  "phone",       // customer phone
  "place",       // area (governorate/wilayat)
  "total",       // total price
  "advance",     // amount already paid → recorded as a payment
  "deliveryDate",// scheduled delivery date (also drives the year filter)
  "deliveredOn", // actual delivery date (for delivered rows)
  "workStatus",  // raw status text, mapped to a system work status
  "description", // free-text summary of the items
  "remarks",     // extra notes
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

// Best-guess default mapping from the known sheet headers to our fields.
export const DEFAULT_MAPPING: Record<ImportField, string> = {
  orderNumber: "Advance Bill No.",
  name: "Name",
  phone: "Phone",
  place: "Place",
  total: "Total Price",
  advance: "Advance",
  deliveryDate: "Delivery date",
  deliveredOn: "del.date",
  workStatus: "Work Status",
  description: "Melboard",
  remarks: "Remarks",
};

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

// Read the first worksheet of an .xlsx buffer into headers + string rows.
export async function parseWorkbook(buffer: Buffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col${c + 1}`;
      const v = cellText(row.getCell(c + 1).value).trim();
      obj[key] = v;
      if (v) any = true;
    }
    if (any) rows.push(obj);
  }
  return { headers: headers.filter(Boolean), rows };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const anyv = value as any;
    if (anyv.text) return String(anyv.text);
    if (anyv.result !== undefined) return String(anyv.result);
    if (anyv.richText) return anyv.richText.map((t: any) => t.text).join("");
    if (anyv.hyperlink) return String(anyv.hyperlink);
    return "";
  }
  return String(value);
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Tolerant date parser for the mixed formats in the sheet: ISO (from real
// date cells), dd.mm.yyyy, d/m/yy, and dd-Mon-yy. Day-first is assumed for
// numeric formats. Returns null when it can't parse.
export function parseSheetDate(raw: string): Date | null {
  const s = (raw || "").trim();
  if (!s) return null;
  // ISO (exceljs emits this for real date cells)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // dd-Mon-yy / dd-Mon-yyyy
  let m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (m) {
    const day = +m[1];
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const year = normYear(+m[3]);
    if (mon !== undefined) return safeDate(year, mon, day);
  }
  // dd.mm.yyyy or d/m/yy or d-m-yy (day first)
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const day = +m[1];
    const mon = +m[2] - 1;
    const year = normYear(+m[3]);
    return safeDate(year, mon, day);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}
function safeDate(year: number, mon: number, day: number): Date | null {
  if (mon < 0 || mon > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, mon, day));
  return isNaN(d.getTime()) ? null : d;
}

// Parse a money value like "1125.000" or "1,125.00" → number.
export function parseMoney(raw: string): number {
  const s = (raw || "").replace(/[^0-9.]/g, "");
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export type SystemWorkStatus =
  | "needs_preparation" | "ready_to_execute" | "in_progress" | "completed"
  | "ready_for_delivery" | "delivered" | "ready_for_install" | "installed";

// A normalized row after mapping — what the API turns into DB records.
export interface MappedRow {
  rowNumber: number;
  orderNumber: string;
  name: string;
  phone: string;
  place: string;
  total: number;
  advance: number;
  deliveryDate: Date | null;
  deliveredOn: Date | null;
  workStatusRaw: string;
  description: string;
  remarks: string;
  year: number | null;
  errors: string[];
}

export function mapRow(
  raw: Record<string, string>,
  rowNumber: number,
  mapping: Record<ImportField, string>,
): MappedRow {
  const get = (f: ImportField) => (mapping[f] ? (raw[mapping[f]] ?? "").trim() : "");
  const deliveryDate = parseSheetDate(get("deliveryDate"));
  const errors: string[] = [];
  const name = get("name");
  const phone = get("phone").replace(/\s+/g, "");
  const orderNumber = get("orderNumber");
  const total = parseMoney(get("total"));

  if (!name) errors.push("missing_name");
  if (!phone) errors.push("missing_phone");
  if (!orderNumber) errors.push("missing_order_number");

  return {
    rowNumber,
    orderNumber,
    name,
    phone,
    place: get("place"),
    total,
    advance: parseMoney(get("advance")),
    deliveryDate,
    deliveredOn: parseSheetDate(get("deliveredOn")),
    workStatusRaw: get("workStatus"),
    description: get("description"),
    remarks: get("remarks"),
    year: deliveryDate ? deliveryDate.getUTCFullYear() : null,
    errors,
  };
}
