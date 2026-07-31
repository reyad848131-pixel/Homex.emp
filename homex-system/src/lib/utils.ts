import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Rounds a monetary amount to 3 decimal places (Omani Rial precision).
 * Central helper so every money calculation rounds identically and float
 * drift cannot accumulate across additions.
 */
export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

/**
 * Parses an integer query param safely, clamping to [min, max] and falling
 * back to `fallback` for missing/NaN input. Prevents malformed pagination
 * params (e.g. ?page=abc) from producing NaN and crashing Prisma queries.
 */
export function parseIntParam(
  value: string | null | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function formatCurrency(amount: number, currency = "ر.ع"): string {
  return `${roundMoney(amount).toFixed(3)} ${currency}`;
}

/**
 * Runs `fn`, retrying when it fails with a Prisma unique-constraint violation
 * (P2002). Used to make sequential number generation (quote/invoice numbers)
 * safe against concurrent creates that would otherwise collide.
 */
export async function withUniqueRetry<T>(
  fn: (attempt: number) => Promise<T>,
  attempts = 5
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (e: any) {
      lastError = e;
      if (e?.code === "P2002" && i < attempts - 1) continue;
      throw e;
    }
  }
  throw lastError;
}

export async function generateQuoteNumber(prisma: any): Promise<string> {
  // Unified format: HX-YYYY-#### — one continuous sequence per YEAR (it does
  // not reset each month), starting fresh at the beginning of every year.
  const now = new Date();
  const prefix = `HX-${now.getFullYear()}-`;

  // Raw query so it sees EVERY quote number, including soft-deleted (trashed)
  // ones — those numbers are still reserved by the unique constraint, so the
  // model-level soft-delete filter must not hide them here (it would cause a
  // duplicate quote_number collision on create). Imported numbers (SW-###,
  // IMP-###) have a different prefix, so they never interfere with this series.
  const rows = (await prisma.$queryRaw`
    SELECT quote_number FROM quotations
    WHERE quote_number LIKE ${prefix + "%"}
  `) as Array<{ quote_number: string }>;

  // Take the highest numeric suffix (parsed, not string-sorted, so it stays
  // correct even past 9999 in a year).
  let seq = 1;
  for (const r of rows) {
    const n = parseInt(r.quote_number.split("-").pop() || "0", 10);
    if (Number.isFinite(n) && n >= seq) seq = n + 1;
  }

  return `${prefix}${seq.toString().padStart(4, "0")}`;
}
