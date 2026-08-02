import { describe, it, expect } from "vitest";
import { isFinanciallyLocked, newTotalBelowPaid, canSetStatus } from "./quote-rules";

describe("isFinanciallyLocked", () => {
  it("is unlocked for a plain draft with no invoice/payments", () => {
    expect(isFinanciallyLocked({ status: "draft", invoice: null, _count: { payments: 0 } })).toBe(false);
  });
  it("locks once an invoice exists", () => {
    expect(isFinanciallyLocked({ status: "approved", invoice: { id: "inv1" }, _count: { payments: 0 } })).toBe(true);
  });
  it("locks once there is at least one payment", () => {
    expect(isFinanciallyLocked({ status: "approved", invoice: null, _count: { payments: 1 } })).toBe(true);
  });
  it("locks when the customer accepted it", () => {
    expect(isFinanciallyLocked({ status: "accepted", invoice: null, _count: { payments: 0 } })).toBe(true);
  });
  it("tolerates a missing _count", () => {
    expect(isFinanciallyLocked({ status: "pending" })).toBe(false);
  });
});

describe("newTotalBelowPaid", () => {
  it("rejects a new total below the amount already paid", () => {
    expect(newTotalBelowPaid(90, 100)).toBe(true);
  });
  it("allows a new total equal to the amount paid", () => {
    expect(newTotalBelowPaid(100, 100)).toBe(false);
  });
  it("allows a new total above the amount paid", () => {
    expect(newTotalBelowPaid(150, 100)).toBe(false);
  });
  it("uses money rounding (no false trip on float noise)", () => {
    // 0.1 + 0.2 = 0.30000000000000004; rounded both sides -> equal, not below.
    expect(newTotalBelowPaid(0.1 + 0.2, 0.3)).toBe(false);
  });
});

describe("canSetStatus", () => {
  it("lets a manager set any status", () => {
    expect(canSetStatus({ role: "manager", status: "approved", selfApprove: false }).ok).toBe(true);
    expect(canSetStatus({ role: "admin", status: "declined", selfApprove: false }).ok).toBe(true);
  });
  it("never lets sales decline", () => {
    const d = canSetStatus({ role: "sales", status: "declined", selfApprove: true });
    expect(d.ok).toBe(false);
    expect(d.ok === false && d.reason).toBe("sales_decline");
  });
  it("lets sales approve only when self-approval is enabled", () => {
    // Self-approval OFF → sales needs a manager to approve.
    const off = canSetStatus({ role: "sales", status: "approved", selfApprove: false });
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.reason).toBe("needs_approval_role");
    // Self-approval ON → sales may approve their own quote.
    expect(canSetStatus({ role: "sales", status: "approved", selfApprove: true }).ok).toBe(true);
  });
});
