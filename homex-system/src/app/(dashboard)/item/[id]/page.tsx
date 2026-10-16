import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpecsCatalog } from "@/lib/foreman";
import { specRowsFromDetails } from "@/lib/specs-catalog";
import { canAccessForeman, foremanAccessIds } from "@/lib/foreman-access";
import { applyQuoteLocation } from "@/lib/quote-location";
import { ItemPageClient } from "./item-client";

// The per-item page opened by scanning the item's barcode (in-app) or from the
// production console. Shows the item's FIXED specs (read-only) plus its LIVE
// components (editable by the foreman/owner). Any signed-in user may view.
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuth();
  const user = session?.user as { id: string; civilId: string } | undefined;
  if (!user) notFound();

  const item = await prisma.quoteItem.findFirst({
    where: { id },
    select: {
      id: true, description: true, quantity: true, details: true, categoryId: true,
      category: { select: { nameAr: true, nameEn: true } },
      quotation: {
        select: {
          id: true, quoteNumber: true, deliveryDate: true, workStatus: true,
          governorate: true, wilayat: true, address: true,
          customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
        },
      },
      photos: { select: { id: true, url: true, kind: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) notFound();

  applyQuoteLocation(item.quotation as Parameters<typeof applyQuoteLocation>[0]);

  const catalog = await getSpecsCatalog();
  const specs = specRowsFromDetails(item.details, catalog);
  const canEdit = canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []));

  // QR encodes the internal item id only (not a public URL); the in-app scanner
  // resolves it to this page. Rendered as a data URL on the server.
  const qr = await QRCode.toDataURL(`item:${item.id}`, { margin: 1, width: 240 }).catch(() => "");

  const data = {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    categoryId: item.categoryId,
    categoryName: { ar: item.category.nameAr, en: item.category.nameEn },
    quoteNumber: item.quotation.quoteNumber,
    quotationId: item.quotation.id,
    deliveryDate: item.quotation.deliveryDate ? item.quotation.deliveryDate.toISOString() : null,
    workStatus: item.quotation.workStatus,
    customerName: item.quotation.customer?.name || "",
    phone: item.quotation.customer ? `${item.quotation.customer.phoneCode}${item.quotation.customer.phone}` : "",
    governorate: item.quotation.customer?.governorate || "",
    wilayat: item.quotation.customer?.wilayat || "",
    specs,
    photos: item.photos,
    qr,
    canEdit,
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <Link href={`/production/${item.quotation.id}`} className="text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white">← {item.quotation.quoteNumber}</Link>
      <ItemPageClient data={data} />
    </div>
  );
}
