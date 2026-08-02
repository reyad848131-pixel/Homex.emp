import { describe, it, expect } from "vitest";
import { curtainMinCount, curtainCountFromDesc, findCurtainViolation } from "./order-rules";

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

describe("curtainCountFromDesc", () => {
  it("extracts the count from a curtain description", () => {
    expect(curtainCountFromDesc("ستائر شيفون (6 ستارة) - 2×2م = 4 م²")).toBe(6);
  });
  it("folds Arabic-Indic digits so they can't bypass the rule", () => {
    expect(curtainCountFromDesc("ستائر شيفون (٣ ستارة) - ...")).toBe(3);
  });
  it("returns 0 for non-curtain / unparseable descriptions", () => {
    expect(curtainCountFromDesc("مطبخ خشب")).toBe(0);
    expect(curtainCountFromDesc("")).toBe(0);
  });
});

describe("findCurtainViolation", () => {
  const item = (n: number) => ({ description: `ستائر شيفون (${n} ستارة) - 2×2م` });

  it("flags a curtain item below the wilayat minimum (8)", () => {
    const v = findCurtainViolation([item(6)], "مسقط");
    expect(v).toEqual({ count: 6, min: 8 });
  });
  it("allows the reduced minimum (5) in Nizwa", () => {
    expect(findCurtainViolation([item(6)], "نزوى")).toBeNull();
    expect(findCurtainViolation([item(4)], "نزوى")).toEqual({ count: 4, min: 5 });
  });
  it("catches an Arabic-digit count on edit (the bypass)", () => {
    expect(findCurtainViolation([{ description: "ستائر شيفون (٣ ستارة)" }], "مسقط")).toEqual({ count: 3, min: 8 });
  });
  it("passes when all curtain items meet the minimum and ignores non-curtain items", () => {
    expect(findCurtainViolation([item(8), { description: "مطبخ خشب" }], "مسقط")).toBeNull();
  });
});
