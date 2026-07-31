import { describe, it, expect } from "vitest";
import { SYSTEM_ROLES, roleHasPermissionIn, type Permission } from "./permissions";

const perms = (key: string): Permission[] =>
  SYSTEM_ROLES.find((r) => r.key === key)?.permissions ?? [];

describe("roleHasPermissionIn", () => {
  it("matches presence/absence of a permission", () => {
    expect(roleHasPermissionIn(["quotes", "payments"], "payments")).toBe(true);
    expect(roleHasPermissionIn(["quotes"], "financials")).toBe(false);
  });
});

// These encode the field-role security guarantees the business relies on:
// field staff never see money, and the driver can't drive the work board.
describe("SYSTEM_ROLES security invariants", () => {
  it("driver: field delivery only — no money, no work board", () => {
    const p = perms("driver");
    expect(p).toContain("deliveries");
    expect(p).not.toContain("financials");
    expect(p).not.toContain("work_orders");
    expect(p).not.toContain("quotes");
  });

  it("photographer: read-only delivery + photography — no money, no board, no edit", () => {
    const p = perms("photographer");
    expect(p).toContain("photography");
    expect(p).toContain("deliveries_view");
    expect(p).not.toContain("deliveries");   // view-only, cannot mutate deliveries
    expect(p).not.toContain("work_orders");
    expect(p).not.toContain("financials");
    expect(p).not.toContain("customers");    // read-only customers only
  });

  it("accountant: full financials + board + delivery + quoting, but no settings/employees", () => {
    const p = perms("accountant");
    expect(p).toEqual(expect.arrayContaining(["financials", "work_orders", "deliveries", "quotes", "quotes_create", "invoices"]));
    expect(p).not.toContain("settings");
    expect(p).not.toContain("employees");
    expect(p).not.toContain("categories");
  });

  it("manager: operational + financials, but not system settings/employees", () => {
    const p = perms("manager");
    expect(p).toEqual(expect.arrayContaining(["financials", "work_orders", "deliveries", "photography"]));
    expect(p).not.toContain("settings");
    expect(p).not.toContain("employees");
  });

  it("admin and ceo hold every permission", () => {
    expect(perms("admin").length).toBeGreaterThan(0);
    expect(perms("ceo")).toEqual(perms("admin"));
  });

  it("ceo is a singleton role", () => {
    expect(SYSTEM_ROLES.find((r) => r.key === "ceo")?.singleton).toBe(true);
  });
});
