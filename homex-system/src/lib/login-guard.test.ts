import { describe, it, expect } from "vitest";
import { normalizeDigits } from "./login-guard";

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
  it("handles a mixed password (Arabic digits inside ASCII text)", () => {
    expect(normalizeDigits("Homex١٢٣٤٥٦٧٨")).toBe("Homex12345678");
  });
  it("is safe on empty/undefined input", () => {
    expect(normalizeDigits("")).toBe("");
    expect(normalizeDigits(undefined as unknown as string)).toBe("");
  });
});
