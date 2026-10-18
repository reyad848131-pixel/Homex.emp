import { redirect } from "next/navigation";

// The per-quote production workspace was unified into the project work page.
// Keep this route working by sending any old link to the new page.
export default async function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/project/${id}`);
}
