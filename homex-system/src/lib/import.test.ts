import { describe, it, expect } from "vitest";
import { parseSheetDate, parseMoney, mapRow, estimateMissingDates, DEFAULT_MAPPING, autoMapHeaders, guessWorkStatus, isNoiseRow, type MappedRow } from "./import";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

describe("parseSheetDate", () => {
  it("parses dd.mm.yyyy (the sheet's Delivery date format), day-first", () => {
    expect(iso(parseSheetDate("03.02.2025"))).toBe("2025-02-03T00:00:00.000Z");
    expect(iso(parseSheetDate("09.02.2025"))).toBe("2025-02-09T00:00:00.000Z");
    expect(iso(parseSheetDate("10.02.2025"))).toBe("2025-02-10T00:00:00.000Z");
  });

  it("parses d/m/yy and dd/mm/yyyy", () => {
    expect(iso(parseSheetDate("28/12/2024"))).toBe("2024-12-28T00:00:00.000Z");
    expect(iso(parseSheetDate("1/1/25"))).toBe("2025-01-01T00:00:00.000Z");
  });

  it("parses dd-Mon-yy (the sheet's del.date format)", () => {
    expect(iso(parseSheetDate("22-Feb-25"))).toBe("2025-02-22T00:00:00.000Z");
    expect(iso(parseSheetDate("2-Mar-25"))).toBe("2025-03-02T00:00:00.000Z");
    expect(iso(parseSheetDate("30-Jan-25"))).toBe("2025-01-30T00:00:00.000Z");
    expect(iso(parseSheetDate("19-Apr-25"))).toBe("2025-04-19T00:00:00.000Z");
  });

  it("parses ISO (from real Excel date cells) without drift", () => {
    expect(iso(parseSheetDate("2026-03-12"))).toBe("2026-03-12T00:00:00.000Z");
    expect(iso(parseSheetDate("2026-03-12T00:00:00.000Z"))).toBe("2026-03-12T00:00:00.000Z");
  });

  it("returns null for empty / unparseable / impossible dates", () => {
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("   ")).toBeNull();
    expect(parseSheetDate("Avai. In Fac")).toBeNull();
    expect(parseSheetDate("45/13/2025")).toBeNull(); // day 45 / month 13
  });

  it("extracts the correct year for the year filter", () => {
    expect(parseSheetDate("03.02.2025")!.getUTCFullYear()).toBe(2025);
    expect(parseSheetDate("12/06/2026")!.getUTCFullYear()).toBe(2026);
    expect(parseSheetDate("28/12/2024")!.getUTCFullYear()).toBe(2024);
  });
});

describe("parseMoney", () => {
  it("parses the sheet's money format", () => {
    expect(parseMoney("1125.000")).toBe(1125);
    expect(parseMoney("610.000")).toBe(610);
    expect(parseMoney("185.000")).toBe(185);
    expect(parseMoney("0.000")).toBe(0);
  });
  it("handles thousands separators and blanks", () => {
    expect(parseMoney("1,125.500")).toBe(1125.5);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("Nill")).toBe(0);
  });
});

describe("autoMapHeaders — the real sheet headers", () => {
  const HEADERS = [
    "S.No.", "Name", "Delivery date", "Phone", "Place", "Booking Date",
    "Melboard", "Melboard Count", "PVC Colours", "Fabrics", "Total Price",
    "Advance", "Balance", "Advance Bill No.", "Delivery Bill No.",
    "Work Status", "del.date", "Payment Status", "Remarks",
  ];
  it("matches each field to the right column", () => {
    const m = autoMapHeaders(HEADERS);
    expect(m.name).toBe("Name");
    expect(m.phone).toBe("Phone");
    expect(m.place).toBe("Place");
    expect(m.total).toBe("Total Price");
    expect(m.advance).toBe("Advance");
    expect(m.deliveryDate).toBe("Delivery date");
    expect(m.deliveredOn).toBe("del.date");
    expect(m.bookingDate).toBe("Booking Date");
    expect(m.workStatus).toBe("Work Status"); // not "Payment Status"
    expect(m.orderNumber).toBe("Advance Bill No.");
  });
  it("is tolerant of case and spacing differences", () => {
    const m = autoMapHeaders(["CUSTOMER NAME", "Mobile No", "Total", "Delivery Date", "Status"]);
    expect(m.name).toBe("CUSTOMER NAME");
    expect(m.phone).toBe("Mobile No");
    expect(m.total).toBe("Total");
    expect(m.deliveryDate).toBe("Delivery Date");
    expect(m.workStatus).toBe("Status");
  });
});

describe("guessWorkStatus — the real status values in the sheet", () => {
  it("maps delivered variants, including the 'Delivey Done' typo", () => {
    expect(guessWorkStatus("Delivery Done")).toBe("delivered");
    expect(guessWorkStatus("Delivey Done")).toBe("delivered"); // typo, missing r
    expect(guessWorkStatus("delivered")).toBe("delivered");
    expect(guessWorkStatus("DELIVERY DONE")).toBe("delivered");
  });
  it("maps finished work to completed", () => {
    expect(guessWorkStatus("Finished")).toBe("completed");
  });
  it("treats month-named statuses (in-progress orders) as in_progress", () => {
    expect(guessWorkStatus("February 02 '2025")).toBe("in_progress");
    expect(guessWorkStatus("MARCH 03 '2025")).toBe("in_progress");
    expect(guessWorkStatus("DECEMBER 12 '2025")).toBe("in_progress");
    expect(guessWorkStatus("")).toBe("in_progress");
  });
  it("maps installation and ready-for-delivery variants", () => {
    expect(guessWorkStatus("Installed")).toBe("delivered");
    expect(guessWorkStatus("Ready for Delivery")).toBe("ready_for_delivery");
  });
});

describe("mapRow — real sample rows", () => {
  const row1: Record<string, string> = {
    "S.No.": "1", "Name": "Khalid Al Adawi", "Delivery date": "03.02.2025",
    "Phone": "99463248", "Place": "Bahla", "Booking Date": "28/12/2024",
    "Melboard": "W2003-T09 + P1340-T03", "Melboard Count": "20 + 9",
    "PVC Colours": "", "Fabrics": "", "Total Price": "1125.000",
    "Advance": "1125.000", "Balance": "0.000", "Advance Bill No.": "SW-316",
    "Delivery Bill No.": "SW-D-306", "Work Status": "Delivery Done",
    "del.date": "22-Feb-25", "Payment Status": "Done", "Remarks": "",
  };

  it("maps every field precisely", () => {
    const m = mapRow(row1, 2, DEFAULT_MAPPING);
    expect(m.orderNumber).toBe("SW-316");
    expect(m.name).toBe("Khalid Al Adawi");
    expect(m.phone).toBe("99463248");
    expect(m.place).toBe("Bahla");
    expect(m.total).toBe(1125);
    expect(m.advance).toBe(1125);
    expect(iso(m.deliveryDate)).toBe("2025-02-03T00:00:00.000Z");
    expect(iso(m.deliveredOn)).toBe("2025-02-22T00:00:00.000Z");
    expect(m.workStatusRaw).toBe("Delivery Done");
    expect(m.description).toBe("W2003-T09 + P1340-T03");
    expect(m.year).toBe(2025);
    expect(m.errors).toEqual([]);
  });

  it("strips spaces from the phone", () => {
    const m = mapRow({ ...row1, Phone: "9946 3248" }, 2, DEFAULT_MAPPING);
    expect(m.phone).toBe("99463248");
  });

  it("flags rows missing a name, phone, or order number", () => {
    const m = mapRow({ ...row1, Name: "", Phone: "", "Advance Bill No.": "" }, 2, DEFAULT_MAPPING);
    expect(m.errors).toContain("missing_name");
    expect(m.errors).toContain("missing_phone");
    expect(m.errors).toContain("missing_order_number");
  });

  it("keeps a 2026 delivery in the 2026 bucket", () => {
    const m = mapRow({ ...row1, "Delivery date": "12.06.2026" }, 2, DEFAULT_MAPPING);
    expect(m.year).toBe(2026);
    expect(iso(m.deliveryDate)).toBe("2026-06-12T00:00:00.000Z");
  });

  it("falls back to booking date for in-progress orders with no delivery date", () => {
    const m = mapRow(
      { ...row1, "Delivery date": "", "Booking Date": "1/8/2025", "Work Status": "In Progress" },
      2, DEFAULT_MAPPING,
    );
    expect(m.deliveryDate).toBeNull();
    expect(m.year).toBe(2025); // taken from the booking date
    expect(m.errors).toEqual([]);
  });
});

describe("isNoiseRow — drops the repeated headers / banners / totals in BRS sheets", () => {
  const base = { name: "", orderNumber: "", phone: "", place: "", workStatusRaw: "" };
  it("flags a repeated column-header row", () => {
    expect(isNoiseRow({ ...base, name: "Name", phone: "Phone", orderNumber: "Advance Bill No.", workStatusRaw: "Work Status" })).toBe(true);
    expect(isNoiseRow({ ...base, name: "name" })).toBe(true);
    expect(isNoiseRow({ ...base, orderNumber: "Advance Bill No." })).toBe(true);
    expect(isNoiseRow({ ...base, workStatusRaw: "Work Status" })).toBe(true);
  });
  it("flags monthly TOTAL summary rows", () => {
    expect(isNoiseRow({ ...base, name: "TOTAL", phone: "TOTAL", place: "TOTAL" })).toBe(true);
  });
  it("flags identity-less rows (empty pre-dated calendar slots)", () => {
    expect(isNoiseRow({ ...base })).toBe(true); // fully empty
    expect(isNoiseRow({ ...base, place: "Nizwa" })).toBe(true); // only a place, no order identity
    // A row with any identity is kept for normal validation, not dropped here.
    expect(isNoiseRow({ ...base, name: "SMES" })).toBe(false);
    expect(isNoiseRow({ ...base, orderNumber: "SW-642" })).toBe(false);
    expect(isNoiseRow({ ...base, phone: "92211625" })).toBe(false);
  });
  it("flags the status-legend section dividers placed in the name cell", () => {
    expect(isNoiseRow({ ...base, name: "Need to Confirm", phone: "Available" })).toBe(true);
    expect(isNoiseRow({ ...base, name: "Available" })).toBe(true);
    expect(isNoiseRow({ ...base, name: "Delivered" })).toBe(true);
    expect(isNoiseRow({ ...base, name: "Work Started" })).toBe(true);
    expect(isNoiseRow({ ...base, name: "NOTE" })).toBe(true);
  });
  it("flags company / month section banners wherever they land", () => {
    expect(isNoiseRow({ ...base, name: "SULTAN AL NABHANI FACTORY FOR WOODY PRODUCTS (BRS)" })).toBe(true);
    expect(isNoiseRow({ ...base, name: "2026' JANUARY 01" })).toBe(true);
    expect(isNoiseRow({ ...base, place: "2026' FEBRUARY 02" })).toBe(true);
  });
  it("keeps real orders — including bill-less ones and normal names", () => {
    expect(isNoiseRow({ ...base, name: "Faisal Al Hinai", orderNumber: "SW-572", phone: "99199614", place: "Al Hamra", workStatusRaw: "Delivery Done" })).toBe(false);
    expect(isNoiseRow({ ...base, name: "Bader Al Nabhani", orderNumber: "", phone: "92211625", place: "Muscut", workStatusRaw: "Need To Order" })).toBe(false);
    expect(isNoiseRow({ ...base, name: "MAHMOUD  SQU HOSPITAL ORDER", phone: "97227077", place: "MUSCAT" })).toBe(false);
  });
  it("mapRow marks noise rows so the importer can drop them", () => {
    const header = { "Name": "Name", "Phone": "Phone", "Advance Bill No.": "Advance Bill No.", "Work Status": "Work Status" };
    expect(mapRow(header, 5, DEFAULT_MAPPING).noise).toBe(true);
    const real = { "Name": "Khalid", "Phone": "99463248", "Advance Bill No.": "SW-316", "Delivery date": "03.02.2026" };
    expect(mapRow(real, 6, DEFAULT_MAPPING).noise).toBe(false);
  });
});

describe("estimateMissingDates — order undated rows by their neighbours", () => {
  // Build a minimal row carrying only what the estimator reads/writes.
  const mk = (deliveryDate: Date | null): MappedRow => ({
    rowNumber: 0, noise: false, orderNumber: "", name: "", phone: "", place: "",
    total: 0, advance: 0, deliveryDate, deliveryDateEstimated: false,
    bookingDate: null, deliveredOn: null, workStatusRaw: "",
    description: "", remarks: "", year: deliveryDate ? deliveryDate.getUTCFullYear() : null, errors: [],
  });
  const d = (s: string) => new Date(s + "T00:00:00.000Z");

  it("interpolates a date between the nearest dated rows above and below", () => {
    const rows = [mk(d("2026-01-10")), mk(null), mk(d("2026-01-20"))];
    estimateMissingDates(rows);
    // Midpoint between Jan 10 and Jan 20 → Jan 15.
    expect(iso(rows[1].deliveryDate)).toBe("2026-01-15T00:00:00.000Z");
    expect(rows[1].deliveryDateEstimated).toBe(true);
    expect(rows[1].year).toBe(2026);
    // Real dates are never touched.
    expect(rows[0].deliveryDateEstimated).toBe(false);
    expect(rows[2].deliveryDateEstimated).toBe(false);
  });

  it("keeps two undated rows in order between the same neighbours", () => {
    const rows = [mk(d("2026-01-10")), mk(null), mk(null), mk(d("2026-01-22"))];
    estimateMissingDates(rows);
    expect(rows[1].deliveryDate!.getTime()).toBeLessThan(rows[2].deliveryDate!.getTime());
  });

  it("inherits the neighbour's date at the top and bottom edges", () => {
    const rows = [mk(null), mk(d("2026-03-05")), mk(null)];
    estimateMissingDates(rows);
    expect(iso(rows[0].deliveryDate)).toBe("2026-03-05T00:00:00.000Z"); // only a neighbour below
    expect(iso(rows[2].deliveryDate)).toBe("2026-03-05T00:00:00.000Z"); // only a neighbour above
    expect(rows[0].deliveryDateEstimated).toBe(true);
    expect(rows[2].deliveryDateEstimated).toBe(true);
  });

  it("leaves rows undated when the whole file has no dates", () => {
    const rows = [mk(null), mk(null)];
    estimateMissingDates(rows);
    expect(rows[0].deliveryDate).toBeNull();
    expect(rows[0].deliveryDateEstimated).toBe(false);
  });
});
