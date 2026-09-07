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

// A manager override must never DROP the total below what the customer already
// paid (that would imply money owed back / a broken balance). It only blocks an
// edit that actually *reduces* the total: pass `prevTotal` so a save that keeps
// or raises the total — e.g. fixing the customer's name on a quote whose total
// is already at/below the paid amount — is allowed. Omitting prevTotal keeps the
// old "any total below paid" behaviour.
export function newTotalBelowPaid(newTotal: number, paid: number, prevTotal: number = Infinity): boolean {
  return roundMoney(newTotal) < roundMoney(paid) && roundMoney(newTotal) < roundMoney(prevTotal);
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
  const isManager = params.role === "admin" || params.role === "ceo" || params.role === "manager";
  if (isManager) return { ok: true };
  // Sales may approve their own quotation only when self-approval is enabled
  // (ownership is enforced in the route). When it's disabled, a manager must
  // approve. Only a manager can decline.
  if (params.status === "approved") {
    return params.selfApprove ? { ok: true } : { ok: false, reason: "needs_approval_role" };
  }
  if (params.status === "declined") return { ok: false, reason: "sales_decline" };
  return { ok: true };
}
