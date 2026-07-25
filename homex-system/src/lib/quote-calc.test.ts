import { describe, it, expect } from "vitest";
import { sanitizeItem, computeQuoteTotals } from "./quote-calc";

describe("sanitizeItem", () => {
  it("recomputes lineTotal from quantity/unitPrice/extras and ignores the client value", () => {
    const item = sanitizeItem(
      { categoryId: "c1", quantity: 2, unitPrice: 10, extras: 5, lineTotal: 1 /* tampered */ },
      0
    );
    expect(item.lineTotal).toBe(25); // 2*10 + 5, not the sent 1
  });

  it("clamps quantity to a minimum of 1", () => {
    const item = sanitizeItem({ categoryId: "c1", quantity: 0, unitPrice: 10 }, 0);
    expect(item.quantity).toBe(1);
    expect(item.lineTotal).toBe(10);
  });

  it("clamps negative unitPrice and extras to 0", () => {
    const item = sanitizeItem({ categoryId: "c1", quantity: 1, unitPrice: -50, extras: -5 }, 0);
    expect(item.unitPrice).toBe(0);
    expect(item.extras).toBe(0);
    expect(item.lineTotal).toBe(0);
  });

  it("coerces non-finite numbers to safe defaults", () => {
    const item = sanitizeItem({ categoryId: "c1", quantity: NaN, unitPrice: Infinity }, 3);
    expect(item.quantity).toBe(1);
    expect(item.unitPrice).toBe(0);
    expect(item.sortOrder).toBe(3);
  });

  it("serializes details to a JSON string and keeps null when absent", () => {
    expect(sanitizeItem({ categoryId: "c1", details: { a: 1 } }, 0).details).toBe('{"a":1}');
    expect(sanitizeItem({ categoryId: "c1" }, 0).details).toBeNull();
  });
});

describe("computeQuoteTotals", () => {
  it("derives subtotal, VAT, total and advance from items", () => {
    const totals = computeQuoteTotals(
      [
        { categoryId: "c1", quantity: 1, unitPrice: 100, extras: 0 },
        { categoryId: "c2", quantity: 2, unitPrice: 50, extras: 0 },
      ],
      0.05,
      15
    );
    expect(totals.subtotal).toBe(200); // 100 + 100
    expect(totals.vatAmount).toBe(10); // 200 * 0.05
    expect(totals.total).toBe(210);
    expect(totals.advanceAmount).toBe(31.5); // 210 * 15%
  });

  it("clamps the advance percentage to 0-100", () => {
    expect(computeQuoteTotals([{ categoryId: "c1", unitPrice: 100 }], 0, 500).advancePct).toBe(100);
    expect(computeQuoteTotals([{ categoryId: "c1", unitPrice: 100 }], 0, -20).advancePct).toBe(0);
  });

  it("rounds monetary values to 3 decimals (OMR precision)", () => {
    const totals = computeQuoteTotals([{ categoryId: "c1", quantity: 3, unitPrice: 33.333 }], 0.05, 0);
    expect(totals.subtotal).toBe(99.999);
    expect(totals.vatAmount).toBe(5); // 99.999 * 0.05 = 4.99995 -> 5.000
  });
});
