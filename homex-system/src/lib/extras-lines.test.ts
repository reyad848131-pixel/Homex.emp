import { describe, it, expect } from "vitest";
import { itemExtraLines, extraLinesSum } from "./extras-lines";

describe("itemExtraLines", () => {
  it("returns [] for missing / malformed details", () => {
    expect(itemExtraLines(null)).toEqual([]);
    expect(itemExtraLines(undefined)).toEqual([]);
    expect(itemExtraLines("{bad json")).toEqual([]);
    expect(itemExtraLines({})).toEqual([]);
    expect(itemExtraLines({ extrasBreakdown: "x" })).toEqual([]);
  });

  it("parses breakdown from a details object", () => {
    const lines = itemExtraLines({ extrasBreakdown: [
      { label: "زجاج ٣م", qty: 3, unitPrice: 60, total: 180 },
      { label: "إضاءة LED", qty: 2, unitPrice: 25, total: 50 },
    ] });
    expect(lines).toHaveLength(2);
    expect(extraLinesSum(lines)).toBe(230);
  });

  it("parses breakdown from a JSON STRING (as stored in the DB)", () => {
    const d = JSON.stringify({ width: 1.2, extrasBreakdown: [{ label: "إضاءة", qty: 1, unitPrice: 20, total: 20 }] });
    const lines = itemExtraLines(d);
    expect(lines).toHaveLength(1);
    expect(lines[0].total).toBe(20);
  });

  it("drops entries that aren't well-formed", () => {
    const lines = itemExtraLines({ extrasBreakdown: [
      { label: "ok", qty: 1, unitPrice: 5, total: 5 },
      { qty: 1, total: 5 },          // no label
      { label: "x", total: "nope" }, // non-numeric total
    ] });
    expect(lines).toHaveLength(1);
  });

  it("base + extras reconciles to the line total", () => {
    const lineTotal = 330;
    const lines = itemExtraLines({ extrasBreakdown: [
      { label: "زجاج", qty: 3, unitPrice: 60, total: 180 },
      { label: "إضاءة", qty: 2, unitPrice: 25, total: 50 },
    ] });
    const base = Math.round((lineTotal - extraLinesSum(lines)) * 1000) / 1000;
    expect(base).toBe(100);
    expect(base + extraLinesSum(lines)).toBe(lineTotal);
  });
});
