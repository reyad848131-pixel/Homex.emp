import { Skeleton } from "@/components/skeleton";

// Shown instantly the moment a quotation is clicked, while the server renders
// the detail page. Without this, navigation appears to "hang" on the previous
// page until the server responds. Its shape mirrors the real detail layout so
// the transition feels seamless.
export default function Loading() {
  return (
    <div>
      {/* Top bar: back + actions */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-9 w-24 rounded" />
        </div>
      </div>

      {/* Header card: number + status */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
      </div>

      {/* Customer card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4">
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <Skeleton className="h-5 w-24 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
        <div className="flex justify-end mt-4">
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
    </div>
  );
}
