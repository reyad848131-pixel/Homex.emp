import { describe, it, expect } from "vitest";
import {
  parseBody,
  loginSchema,
  createQuotationSchema,
  paymentSchema,
  employeeCreateSchema,
} from "./schemas";

describe("parseBody + loginSchema", () => {
  it("accepts valid credentials", () => {
    const r = parseBody(loginSchema, { civilId: "123", password: "secret" });
    expect(r.ok).toBe(true);
  });
  it("rejects missing password", () => {
    const r = parseBody(loginSchema, { civilId: "123" });
    expect(r.ok).toBe(false);
  });
});

describe("createQuotationSchema", () => {
  const validCustomer = { name: "A", phone: "9", governorate: "G", wilayat: "W" };

  it("requires at least one item", () => {
    const r = parseBody(createQuotationSchema, { customer: validCustomer, items: [] });
    expect(r.ok).toBe(false);
  });
  it("accepts a valid quotation", () => {
    const r = parseBody(createQuotationSchema, {
      customer: validCustomer,
      items: [{ categoryId: "c1", quantity: 1, unitPrice: 10 }],
    });
    expect(r.ok).toBe(true);
  });
  it("rejects an incomplete customer", () => {
    const r = parseBody(createQuotationSchema, {
      customer: { name: "A" },
      items: [{ categoryId: "c1" }],
    });
    expect(r.ok).toBe(false);
  });
});

describe("paymentSchema", () => {
  it("rejects non-positive amounts", () => {
    expect(parseBody(paymentSchema, { quotationId: "q", amount: 0 }).ok).toBe(false);
    expect(parseBody(paymentSchema, { quotationId: "q", amount: -5 }).ok).toBe(false);
  });
  it("accepts a positive amount", () => {
    expect(parseBody(paymentSchema, { quotationId: "q", amount: 10 }).ok).toBe(true);
  });
});

describe("employeeCreateSchema", () => {
  it("rejects an empty role", () => {
    // The schema now accepts any non-empty role key (system or custom); the
    // route verifies it exists. An empty role must still be rejected.
    const r = parseBody(employeeCreateSchema, {
      name: "A", civilId: "1", password: "secret6", role: "",
    });
    expect(r.ok).toBe(false);
  });
  it("accepts a custom role key", () => {
    const r = parseBody(employeeCreateSchema, {
      name: "A", civilId: "1", password: "secret6", role: "accountant",
    });
    expect(r.ok).toBe(true);
  });
  it("rejects a password shorter than 6 chars", () => {
    const r = parseBody(employeeCreateSchema, {
      name: "A", civilId: "1", password: "123", role: "sales",
    });
    expect(r.ok).toBe(false);
  });
  it("accepts a valid employee", () => {
    const r = parseBody(employeeCreateSchema, {
      name: "A", civilId: "1", password: "secret6", role: "manager",
    });
    expect(r.ok).toBe(true);
  });
});
