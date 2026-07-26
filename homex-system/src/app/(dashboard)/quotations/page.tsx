import { getAuth } from "@/lib/auth";
import { getQuotationsList } from "@/lib/quotations-list";
import { userCan } from "@/lib/permissions";
import { QuotationsClient } from "./quotations-client";

// Server-render the first page so the list paints with real data (no skeleton
// flash); the client component takes over for search / filter / pagination.
export default async function QuotationsPage() {
  const session = await getAuth();
  const user = session?.user as any;
  const isAdmin = (user?.role === "admin" || user?.role === "ceo") || user?.role === "manager" || await userCan(user?.role, "view_all_quotes");

  const initial = await getQuotationsList({ userId: user?.id, isAdmin, page: 1, limit: 20 });

  return (
    <QuotationsClient
      initialData={{ quotations: JSON.parse(JSON.stringify(initial.quotations)), total: initial.total }}
    />
  );
}
