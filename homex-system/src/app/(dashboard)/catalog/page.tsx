import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { catalogAccessIds, canManageCatalog } from "@/lib/catalog-access";
import CatalogClient from "./catalog-client";

// The production specs Catalog — define the wood / colour / fabric / channel
// option lists that feed the quote builders. Restricted to the two permanent
// owners (Riyad / Salim by civil id) plus anyone designated in Settings
// (typically the accountant Deepak and the foreman Othman). Enforced here on the
// server so the page can't be reached by URL, and again in the API for saves.
export default async function CatalogPage() {
  const session = await getAuth();
  if (!session) redirect("/login");
  const user = session.user as { id: string; civilId: string };
  const editorIds = await catalogAccessIds().catch(() => [] as string[]);
  if (!canManageCatalog(user.civilId, user.id, editorIds)) redirect("/");

  const cats = await prisma.category
    .findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameAr: true, nameEn: true } })
    .catch(() => [] as { id: string; nameAr: string; nameEn: string }[]);

  return <CatalogClient categories={cats} />;
}
