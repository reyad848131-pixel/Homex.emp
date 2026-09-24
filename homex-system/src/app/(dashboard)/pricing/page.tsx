import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { pricingEditorIds, canManagePricing } from "@/lib/pricing-access";
import PricingClient from "./pricing-client";

// The Pricing page — change the DEFAULT prices the quote builders start from.
// Restricted to the two permanent owners (Riyad / Salim by civil id) plus anyone
// they designate in Settings. Enforced here on the server so the page can't be
// reached by URL, and again in the pricing API for saves.
export default async function PricingPage() {
  const session = await getAuth();
  if (!session) redirect("/login");
  const user = session.user as { id: string; civilId: string };
  const editorIds = await pricingEditorIds().catch(() => [] as string[]);
  if (!canManagePricing(user.civilId, user.id, editorIds)) redirect("/");
  return <PricingClient />;
}
