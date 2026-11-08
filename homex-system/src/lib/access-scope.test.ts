import { describe, it, expect, vi } from "vitest";

// Mock the settings store so role resolution needs no database. Provides two
// custom roles to prove the access-scoping fix: one scoped (no view_all_quotes)
// and one broad (with it).
vi.mock("./settings", () => ({
  getSettings: async () => ({
    custom_roles: JSON.stringify([
      { key: "scoped_sales", label: "مندوب مقيّد", permissions: ["quotes", "quotes_create"] },
      { key: "broad_sales", label: "مندوب موسّع", permissions: ["quotes", "view_all_quotes"] },
      { key: "ops_only", label: "تشغيل", permissions: ["deliveries"] },
    ]),
  }),
  getSetting: async () => undefined,
}));

import { seesAllRecords, ownScopedOnly, hasReportsAccess } from "./permissions";

describe("record-visibility scoping (IDOR guard)", () => {
  it("broad built-in roles see all records", async () => {
    for (const r of ["admin", "ceo", "manager", "accountant"]) {
      expect(await seesAllRecords(r)).toBe(true);
      expect(await ownScopedOnly(r)).toBe(false);
    }
  });

  it("sales and field roles are scoped to their own records", async () => {
    for (const r of ["sales", "driver", "photographer"]) {
      expect(await seesAllRecords(r)).toBe(false);
      expect(await ownScopedOnly(r)).toBe(true);
    }
  });

  it("custom role WITHOUT view_all_quotes is scoped to its own records", async () => {
    // This is the exact hole the fix closes: a custom role that isn't literally
    // "sales" must still be restricted to its own quotes/customers.
    expect(await seesAllRecords("scoped_sales")).toBe(false);
    expect(await ownScopedOnly("scoped_sales")).toBe(true);
  });

  it("custom role WITH view_all_quotes sees all records", async () => {
    expect(await seesAllRecords("broad_sales")).toBe(true);
    expect(await ownScopedOnly("broad_sales")).toBe(false);
  });

  it("an unknown role defaults to the most restrictive scope", async () => {
    expect(await seesAllRecords("does_not_exist")).toBe(false);
    expect(await ownScopedOnly("does_not_exist")).toBe(true);
  });
});

describe("reports / full-export access", () => {
  it("granted to broad roles and the accountant", async () => {
    for (const r of ["admin", "ceo", "manager", "accountant"]) {
      expect(await hasReportsAccess(r)).toBe(true);
    }
  });

  it("denied to sales, field roles, and limited custom roles", async () => {
    for (const r of ["sales", "driver", "photographer", "scoped_sales", "ops_only"]) {
      expect(await hasReportsAccess(r)).toBe(false);
    }
  });
});
