import type { TranslationKey } from "@/lib/i18n";

// Whole days from today until the given date (date-only). null when no date.
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Ordered urgency buckets shared by the delivery and installation schedules —
// nearest first. A row lands in the first bucket whose test passes.
export const URGENCY_GROUPS: Array<{ key: string; labelKey: TranslationKey; test: (d: number) => boolean; tone: string }> = [
  { key: "overdue", labelKey: "grpOverdue", test: (d) => d < 0, tone: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  { key: "thisWeek", labelKey: "grpThisWeek", test: (d) => d >= 0 && d <= 7, tone: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
  { key: "nextWeek", labelKey: "grpNextWeek", test: (d) => d >= 8 && d <= 14, tone: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  { key: "thisMonth", labelKey: "grpThisMonth", test: (d) => d >= 15 && d <= 31, tone: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "later", labelKey: "grpLater", test: (d) => d > 31, tone: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600" },
];

export const NEUTRAL_TONE = "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";

// Human "X days / today / late by X" label for a days-remaining value.
export function daysRemainingLabel(d: number, t: (k: TranslationKey) => string): string {
  if (d < 0) return `${t("lateBy")} ${Math.abs(d)} ${t("day")}`;
  if (d === 0) return t("today");
  return `${d} ${t("day")}`;
}
