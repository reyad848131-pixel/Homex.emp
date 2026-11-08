import { timingSafeEqual } from "crypto";

// Constant-time check of the cron Authorization header against CRON_SECRET.
// Using timingSafeEqual (and a length guard) avoids leaking the secret through
// response-time differences on a byte-by-byte string compare.
export function cronHeaderMatches(authHeader: string | null, secret: string | undefined | null): boolean {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
