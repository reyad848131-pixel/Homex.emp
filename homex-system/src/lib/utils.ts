import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(3)} ر.ع`;
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
