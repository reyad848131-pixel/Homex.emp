import { ListSkeleton } from "@/components/skeleton";

// Instant skeleton while the server renders this list page.
export default function Loading() {
  return <ListSkeleton rows={7} />;
}
