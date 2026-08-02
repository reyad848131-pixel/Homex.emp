import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getRolePermissions } from "@/lib/permissions";
import QuoteDetailClient from "./quote-detail-client";

export const dynamic = "force-dynamic";

// Server component: fetches the quotation (with the same shape the client
// expects) and the couple of settings it needs, then hands them to the client
// component as initial props. This means the page paints with real data on the
// first byte — no loading spinner and no client-side API round-trips on mount.
export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuth();
  const user = session?.user as { id: string; role: string } | undefined;

  // Only roles that can view quotations may open one (they show prices/money).
  // Field roles like driver/photographer are blocked at the URL level.
  const canViewQuotes = user
    ? user.role === "admin" || user.role === "ceo" || user.role === "manager" ||
      ((await getRolePermissions(user.role).catch(() => [])) as string[]).includes("quotes")
    : false;

  let quotation = user && canViewQuotes
    ? await prisma.quotation.findFirst({
        where: { id },
        include: {
          customer: true,
          employee: { select: { id: true, name: true, civilId: true } },
          items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
          payments: { include: { recorder: { select: { name: true } } }, orderBy: { paidAt: "desc" } },
          invoice: { include: { issuer: { select: { name: true } } } },
        },
      })
    : null;

  // Sales staff may only open their own quotations — mirror the API's rule.
  if (quotation && user?.role === "sales" && quotation.employeeId !== user.id) {
    quotation = null;
  }

  // Serialize to the exact JSON shape the client interface expects (Dates ->
  // ISO strings), identical to what the /api/quotations/[id] response returns.
  const initialQuote = quotation ? JSON.parse(JSON.stringify(quotation)) : null;

  const settings = await getSettings().catch(() => ({} as Record<string, string>));

  return (
    <QuoteDetailClient
      id={id}
      initialQuote={initialQuote}
      initialTerms={settings.terms_conditions || ""}
      initialSelfApprove={settings.allow_self_approve !== "false"}
      initialMe={user ? { id: user.id, role: user.role } : null}
      initialWaTemplate={settings.wa_template_quote || ""}
      initialCompany={{ name: settings.company_name || "", phone: settings.company_phone || "" }}
    />
  );
}
