import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForeman, foremanAccessIds } from "@/lib/foreman-access";
import { applyQuoteLocation } from "@/lib/quote-location";
import { parseItemDesc } from "@/lib/item-desc";
import { ProjectPageClient } from "./project-client";

// The project page opened by scanning the shared project barcode (one QR per
// quote). Lists every section (item) of the project in order, each with its
// live progress, linking to that section's full details. Any signed-in user may
// VIEW; only the foreman/owner can edit once inside a section.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuth();
  const user = session?.user as { id: string; civilId: string } | undefined;
  if (!user) notFound();

  const quote = await prisma.quotation.findFirst({
    where: { id },
    select: {
      id: true, quoteNumber: true, deliveryDate: true, workStatus: true,
      governorate: true, wilayat: true, address: true,
      customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, description: true, quantity: true,
          category: { select: { nameAr: true, nameEn: true } },
          tasks: { select: { doneAt: true } },
        },
      },
    },
  });
  if (!quote) notFound();
  applyQuoteLocation(quote as Parameters<typeof applyQuoteLocation>[0]);

  const canEdit = canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []));

  const data = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    deliveryDate: quote.deliveryDate ? quote.deliveryDate.toISOString() : null,
    customerName: quote.customer?.name || "",
    phone: quote.customer ? `${quote.customer.phoneCode}${quote.customer.phone}` : "",
    governorate: quote.customer?.governorate || "",
    wilayat: quote.customer?.wilayat || "",
    canEdit,
    sections: quote.items.map((it) => {
      const total = it.tasks.length;
      const done = it.tasks.filter((tk) => tk.doneAt).length;
      return {
        id: it.id,
        categoryName: { ar: it.category.nameAr, en: it.category.nameEn },
        title: parseItemDesc(it.description).title || it.description,
        quantity: it.quantity,
        done,
        total,
      };
    }),
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <ProjectPageClient data={data} />
    </div>
  );
}
