import { describe, it, expect } from "vitest";
import { normalizeDigits, stripInvisible, normalizeCredential, normalizePhone } from "./text";

describe("normalizeDigits", () => {
  it("converts Arabic-Indic digits to ASCII", () => {
    expect(normalizeDigits("١٢٣٤٥٦٧٨")).toBe("12345678");
  });
  it("converts Persian digits to ASCII", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });
  it("leaves ASCII and letters untouched", () => {
    expect(normalizeDigits("Homex12345678")).toBe("Homex12345678");
  });
});

describe("stripInvisible", () => {
  it("removes a leading Right-to-Left Mark (U+200F) — the iOS RTL bug", () => {
    const withRlm = "‏1383";
    expect(withRlm.length).toBe(5);
    expect(stripInvisible(withRlm)).toBe("1383");
  });
  it("removes zero-width, LRM/RLM, bidi isolates and BOM", () => {
    expect(stripInvisible("​‎1‏3⁦﻿83")).toBe("1383");
  });
  it("leaves normal text untouched", () => {
    expect(stripInvisible("Homex1383")).toBe("Homex1383");
  });
});

describe("normalizeCredential", () => {
  it("strips the RTL mark, folds Arabic digits and trims — all in one", () => {
    expect(normalizeCredential(" ‏١٣٨٣ ")).toBe("1383");
  });
  it("is safe on empty/undefined input", () => {
    expect(normalizeCredential("")).toBe("");
    expect(normalizeCredential(undefined as unknown as string)).toBe("");
  });
});

describe("normalizePhone", () => {
  it("keeps digits only and folds Arabic digits (not wiping them)", () => {
    expect(normalizePhone("٩١٢٣ ٤٥٦٧")).toBe("91234567");
  });
  it("drops invisible marks and separators", () => {
    expect(normalizePhone("‏9123-4567")).toBe("91234567");
  });
});
