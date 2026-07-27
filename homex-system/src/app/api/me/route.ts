import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getRolePermissions } from "@/lib/permissions";

export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const permissions = (await getRolePermissions(user.role).catch(() => [])) as string[];
  const has = (p: string) => permissions.includes(p as any);
  const privileged = user.role === "admin" || user.role === "ceo" || user.role === "manager";

  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    role: user.role,
    civilId: user.civilId,
    permissions,
    // Convenience flags the client uses to hide controls / redact money.
    canSeeFinancials: privileged || has("financials"),
    canManageCustomers: privileged || has("customers"),
    canEditDeliveries: privileged || has("work_orders") || has("deliveries"),
  });
  res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  return res;
}
