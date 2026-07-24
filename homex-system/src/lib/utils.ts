import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "ر.ع"): string {
  return `${amount.toFixed(3)} ${currency}`;
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
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `HX-${y}${m}-`;

  const last = await prisma.quotation.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  let seq = 1;
  if (last) {
    const lastNum = parseInt(last.quoteNumber.split("-").pop() || "0", 10);
    seq = lastNum + 1;
  }

  return `${prefix}${seq.toString().padStart(4, "0")}`;
}
