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
  "deliveryDate",// scheduled delivery date (drives the year filter when present)
  "bookingDate", // order/booking date (year fallback for in-progress orders)
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
  bookingDate: "Booking Date",
  deliveredOn: "del.date",
  workStatus: "Work Status",
  description: "Melboard",
  remarks: "Remarks",
};

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  headerRow: number;   // 1-based row where headers were found
  sheets: string[];    // names of all worksheets (tabs) in the workbook
  sheetName: string;   // the worksheet that was actually read
}

// Normalize a header for fuzzy matching: lowercase, keep only a-z0-9.
function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Keywords (normalized) that identify each target field in a header cell.
const FIELD_SYNONYMS: Record<ImportField, string[]> = {
  orderNumber: ["advancebillno", "billno", "orderno", "ordernumber", "advbill", "quoteno", "invoiceno"],
  name: ["name", "customername", "customer", "clientname", "client"],
  phone: ["phone", "mobile", "contactno", "contact", "whatsapp", "tel", "phoneno"],
  place: ["place", "area", "wilayat", "wilaya", "governorate", "location", "region", "city", "address"],
  total: ["totalprice", "total", "grandtotal", "amount", "price", "netamount"],
  advance: ["advance", "advancepaid", "paid", "deposit", "downpayment"],
  deliveryDate: ["deliverydate", "promiseddate", "duedate", "targetdate", "deliverydt"],
  bookingDate: ["bookingdate", "orderdate", "dateofbooking", "booking", "bookeddate"],
  deliveredOn: ["deldate", "delivereddate", "actualdelivery", "deliveredon", "deliverdate"],
  workStatus: ["workstatus", "orderstatus", "jobstatus", "status"],
  description: ["melboard", "description", "details", "item", "items", "product", "desc", "particulars"],
  remarks: ["remarks", "notes", "note", "comment", "comments"],
};

// Build a best-effort field→header mapping from the detected headers.
export function autoMapHeaders(headers: string[]): Record<ImportField, string> {
  const normed = headers.map((h) => ({ raw: h, n: norm(h) }));
  const used = new Set<string>();
  const out = {} as Record<ImportField, string>;
  for (const field of IMPORT_FIELDS) {
    const syns = FIELD_SYNONYMS[field];
    let best = "";
    let bestScore = 0;
    for (const h of normed) {
      if (!h.n || used.has(h.raw)) continue;
      for (const s of syns) {
        // Exact match is strongest, then "contains".
        const score = h.n === s ? 100 + s.length : h.n.includes(s) ? 10 + s.length : 0;
        if (score > bestScore) { bestScore = score; best = h.raw; }
      }
    }
    if (best) { out[field] = best; used.add(best); } else { out[field] = ""; }
  }
  return out;
}

// Score a row's cells by how many look like known headers — used to locate the
// real header row when the sheet has a title/blank rows above it.
function headerScore(cells: string[]): number {
  const allSyns = Object.values(FIELD_SYNONYMS).flat();
  let score = 0;
  for (const c of cells) {
    const n = norm(c);
    if (!n) continue;
    if (allSyns.some((s) => n === s || n.includes(s))) score++;
  }
  return score;
}

// Read the first worksheet into headers + string rows. The header row is
// auto-detected (scanning the first rows) unless headerRowOverride is given.
export async function parseWorkbook(buffer: Buffer, headerRowOverride?: number, sheetName?: string): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheets = wb.worksheets.map((w) => w.name);
  // Pick the requested tab, else the first one.
  const ws = (sheetName ? wb.worksheets.find((w) => w.name === sheetName) : null) || wb.worksheets[0];
  if (!ws) return { headers: [], rows: [], headerRow: 1, sheets, sheetName: "" };

  const readCells = (r: number): string[] => {
    const row = ws.getRow(r);
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { cells[col - 1] = cellText(cell.value).trim(); });
    return cells;
  };

  let headerRow = headerRowOverride && headerRowOverride > 0 ? headerRowOverride : 1;
  if (!headerRowOverride) {
    let bestScore = -1;
    const limit = Math.min(ws.rowCount, 20);
    for (let r = 1; r <= limit; r++) {
      const score = headerScore(readCells(r));
      if (score > bestScore) { bestScore = score; headerRow = r; }
    }
  }

  const headers = readCells(headerRow);

  const rows: Record<string, string>[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const cells = readCells(r);
    const obj: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col${c + 1}`;
      const v = cells[c] || "";
      obj[key] = v;
      if (v) any = true;
    }
    if (any) rows.push(obj);
  }
  return { headers: headers.filter(Boolean), rows, headerRow, sheets, sheetName: ws.name };
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

// Classify a raw "Work Status" cell into a system work status, tolerant of
// typos, casing and the sheet's quirks (e.g. "Delivey Done" missing an r, or a
// target month written in the status column for in-progress orders).
export function guessWorkStatus(raw: string): SystemWorkStatus {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "in_progress"; // blank → still being worked on
  const has = (...subs: string[]) => subs.some((x) => s.includes(x));
  // Delivered — "delivery done", "delivered", and the typo "delivey done".
  if (has("deliv") && has("done", "delivered", "complete")) return "delivered";
  if (s === "delivered" || s === "delivery done" || s === "delivey done") return "delivered";
  // Installation.
  if (has("install") && has("done", "complete", "finished")) return "installed";
  if (has("ready") && has("install")) return "ready_for_install";
  if (has("install")) return "installed";
  // Ready for delivery.
  if (has("ready") && has("deliv")) return "ready_for_delivery";
  if (has("ready for del", "ready to del", "for delivery")) return "ready_for_delivery";
  // Work finished (but not yet delivered).
  if (has("finish", "complete", "done", "ready")) return "completed";
  // Everything else (month names, "pending", "wip", blank-ish) → in progress.
  return "in_progress";
}

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
  bookingDate: Date | null;
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
  const bookingDate = parseSheetDate(get("bookingDate"));
  const errors: string[] = [];
  const name = get("name");
  const phone = get("phone").replace(/\s+/g, "");
  const orderNumber = get("orderNumber");
  const total = parseMoney(get("total"));

  if (!name) errors.push("missing_name");
  if (!phone) errors.push("missing_phone");
  if (!orderNumber) errors.push("missing_order_number");

  // Year comes from the delivery date; for in-progress orders that have no
  // delivery date yet, fall back to the booking (order) date so they're still
  // included and land in the work board.
  const year = deliveryDate ? deliveryDate.getUTCFullYear()
    : bookingDate ? bookingDate.getUTCFullYear() : null;

  return {
    rowNumber,
    orderNumber,
    name,
    phone,
    place: get("place"),
    total,
    advance: parseMoney(get("advance")),
    deliveryDate,
    bookingDate,
    deliveredOn: parseSheetDate(get("deliveredOn")),
    workStatusRaw: get("workStatus"),
    description: get("description"),
    remarks: get("remarks"),
    year,
    errors,
  };
}
