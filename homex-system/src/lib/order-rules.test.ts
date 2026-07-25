import { describe, it, expect } from "vitest";
import { curtainMinCount } from "./order-rules";

describe("curtainMinCount", () => {
  it("returns 5 for Bahla, Nizwa and Al Hamra", () => {
    expect(curtainMinCount("بهلاء")).toBe(5);
    expect(curtainMinCount("نزوى")).toBe(5);
    expect(curtainMinCount("الحمراء")).toBe(5);
  });
  it("returns 8 for any other wilayat", () => {
    expect(curtainMinCount("صور")).toBe(8);
    expect(curtainMinCount("مسقط")).toBe(8);
  });
  it("returns 8 for empty/undefined and trims whitespace", () => {
    expect(curtainMinCount("")).toBe(8);
    expect(curtainMinCount(undefined)).toBe(8);
    expect(curtainMinCount("  نزوى  ")).toBe(5);
  });
});
