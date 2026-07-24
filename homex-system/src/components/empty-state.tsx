import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Consistent empty-state block for list/table pages: a muted icon, a title,
 * an optional description, and an optional call-to-action link.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-gray-700 dark:text-gray-200 font-bold">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
