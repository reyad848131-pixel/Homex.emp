import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { canAccessForeman, foremanAccessIds } from "@/lib/foreman-access";
import { applyQuoteLocation } from "@/lib/quote-location";
import { getQuoteWork } from "@/lib/foreman";
import { ProjectPageClient } from "./project-client";

// The per-quote WORK PAGE, opened by scanning the project barcode or from the
// "صفحة العمل" button in the foreman console. Shows the whole quote's work in
// one dedicated page: material ordering, the template action, and a full spec
// sheet (stages / photos / components) per section. Any signed-in user may
// VIEW; only the foreman/owner can edit (controls are gated by canEdit).
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuth();
  const user = session?.user as { id: string; civilId: string } | undefined;
  if (!user) notFound();

  const work = await getQuoteWork(id);
  if (!work) notFound();
  const { quote, items, workers } = work;
  applyQuoteLocation(quote as Parameters<typeof applyQuoteLocation>[0]);

  const canEdit = canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []));

  const data = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    deliveryDate: quote.deliveryDate ? quote.deliveryDate.toISOString() : null,
    workStatus: quote.workStatus,
    woodStatus: quote.woodStatus || "not_ordered",
    fabricStatus: quote.fabricStatus || "not_ordered",
    customerName: quote.customer?.name || "",
    phone: quote.customer ? `${quote.customer.phoneCode}${quote.customer.phone}` : "",
    governorate: quote.customer?.governorate || "",
    wilayat: quote.customer?.wilayat || "",
    canEdit,
    items: JSON.parse(JSON.stringify(items)),
    workers: JSON.parse(JSON.stringify(workers)),
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <ProjectPageClient data={data} />
    </div>
  );
}
