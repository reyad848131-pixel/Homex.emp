import { roundMoney } from "./utils";

// A quotation is financially frozen once it is invoiced, has payments, or the
// customer accepted it — its priced items must not change (except by a manager
// override that resyncs the invoice).
export function isFinanciallyLocked(q: {
  status: string;
  invoice?: { id: string } | null;
  _count?: { payments: number };
  signedAt?: Date | string | null;
}): boolean {
  return !!q.invoice || (q._count?.payments ?? 0) > 0 || q.status === "accepted" || !!q.signedAt;
}

// A manager override must never drop the total below what the customer already
// paid (that would imply money owed back / a broken balance).
export function newTotalBelowPaid(newTotal: number, paid: number): boolean {
  return roundMoney(newTotal) < roundMoney(paid);
}

export type StatusDecision = { ok: true } | { ok: false; reason: "sales_decline" | "needs_approval_role" };

// Whether a user may move a quotation into the given status.
// - Managers/admins may set any valid status.
// - Sales may never decline.
// - Sales may approve only when self-approval is enabled in settings.
export function canSetStatus(params: {
  role: string;
  status: string;
  selfApprove: boolean;
}): StatusDecision {
  const isManager = params.role === "admin" || params.role === "manager";
  if (isManager) return { ok: true };
  if (params.status === "declined") return { ok: false, reason: "sales_decline" };
  if (params.status === "approved" && !params.selfApprove) {
    return { ok: false, reason: "needs_approval_role" };
  }
  return { ok: true };
}
