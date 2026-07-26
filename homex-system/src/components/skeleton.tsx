/**
 * Lightweight skeleton placeholders shown instantly while data loads, so the
 * UI feels responsive instead of showing a blank "loading" spinner.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
  );
}

/** A skeleton stand-in for a table of rows (used by list pages). */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 px-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1 max-w-[160px]" />
          <Skeleton className="h-4 w-20 max-sm:hidden" />
          <Skeleton className="h-4 w-16 ms-auto" />
        </div>
      ))}
    </div>
  );
}

/**
 * A full list-page skeleton (title + toolbar + table card). Shown instantly on
 * navigation to a server-rendered list page so the click feels immediate
 * instead of "hanging" while the server fetches the first page of data.
 */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-10 flex-1 rounded" />
        <Skeleton className="h-10 w-28 rounded max-sm:hidden" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        <TableSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** A skeleton grid of stat/summary cards. */
export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded p-5">
          <Skeleton className="h-10 w-10 rounded-lg mb-3" />
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}
