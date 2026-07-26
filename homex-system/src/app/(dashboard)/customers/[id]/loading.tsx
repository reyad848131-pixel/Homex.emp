import { Skeleton, TableSkeleton } from "@/components/skeleton";

// Instant skeleton while the server renders the customer detail page.
export default function Loading() {
  return (
    <div>
      <Skeleton className="h-8 w-32 mb-4" />
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
}
