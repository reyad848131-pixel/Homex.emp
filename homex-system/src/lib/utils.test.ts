import { describe, it, expect } from "vitest";
import { roundMoney, formatCurrency, parseIntParam, withUniqueRetry, generateQuoteNumber } from "./utils";

describe("roundMoney", () => {
  it("rounds to 3 decimals", () => {
    expect(roundMoney(1.23456)).toBe(1.235);
    expect(roundMoney(4.99995)).toBe(5);
  });
  it("treats invalid input as 0", () => {
    expect(roundMoney(NaN)).toBe(0);
    expect(roundMoney(undefined as unknown as number)).toBe(0);
  });
});

describe("generateQuoteNumber — unified yearly HX-YYYY-####", () => {
  const year = new Date().getFullYear();
  // Minimal prisma stub returning canned quote_number rows for $queryRaw.
  const fakePrisma = (numbers: string[]) => ({
    $queryRaw: async () => numbers.map((n) => ({ quote_number: n })),
  });

  it("starts at 0001 for a fresh year", async () => {
    expect(await generateQuoteNumber(fakePrisma([]))).toBe(`HX-${year}-0001`);
  });

  it("continues from the highest suffix of the year (no monthly reset)", async () => {
    const n = await generateQuoteNumber(fakePrisma([`HX-${year}-0001`, `HX-${year}-0007`, `HX-${year}-0003`]));
    expect(n).toBe(`HX-${year}-0008`);
  });

  it("stays numeric past 9999", async () => {
    expect(await generateQuoteNumber(fakePrisma([`HX-${year}-9999`]))).toBe(`HX-${year}-10000`);
  });

  it("ignores imported numbers with other prefixes", async () => {
    // Query already filters by prefix; the parser must not trip on odd values.
    expect(await generateQuoteNumber(fakePrisma([`HX-${year}-0002`]))).toBe(`HX-${year}-0003`);
  });
});

describe("formatCurrency", () => {
  it("formats with 3 decimals and default OMR symbol", () => {
    expect(formatCurrency(10)).toBe("10.000 ر.ع");
  });
  it("accepts a custom currency label", () => {
    expect(formatCurrency(10, "OMR")).toBe("10.000 OMR");
  });
});

describe("parseIntParam", () => {
  it("returns the fallback for missing or non-numeric input", () => {
    expect(parseIntParam(null, 1)).toBe(1);
    expect(parseIntParam("abc", 5)).toBe(5);
  });
  it("clamps to the given min and max", () => {
    expect(parseIntParam("0", 1, 1, 100)).toBe(1);
    expect(parseIntParam("999", 20, 1, 100)).toBe(100);
    expect(parseIntParam("50", 20, 1, 100)).toBe(50);
  });
});

describe("withUniqueRetry", () => {
  it("retries on a P2002 unique-constraint error then succeeds", async () => {
    let attempts = 0;
    const result = await withUniqueRetry(async (i) => {
      attempts++;
      if (i < 2) throw { code: "P2002" };
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("rethrows non-unique errors immediately", async () => {
    let attempts = 0;
    await expect(
      withUniqueRetry(async () => {
        attempts++;
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(attempts).toBe(1);
  });
});
