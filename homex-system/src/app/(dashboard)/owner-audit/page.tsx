import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { OwnerAuditClient } from "./owner-audit-client";

// Owner-only diagnostic page. Hidden from everyone except the owner (civil id
// 2016); the actual data is additionally gated behind his private passcode in
// the API. A non-owner simply gets a 404 — the page doesn't exist for them.
export default async function OwnerAuditPage() {
  const session = await getAuth();
  const user = session?.user as { civilId?: string } | undefined;
  if (!user || user.civilId !== "2016") notFound();
  return <OwnerAuditClient />;
}
