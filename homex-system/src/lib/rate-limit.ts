// Lightweight in-memory rate limiter for public (unauthenticated) endpoints.
// Keyed by an arbitrary string (e.g. IP + token). Best-effort only: serverless
// instances don't share memory, so this throttles bursts against a single warm
// instance rather than being a hard global cap — enough to blunt casual abuse
// of the token-gated public routes, which are already state-guarded server-side.
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistically drop expired keys so the map can't grow unbounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Best-effort client IP from the usual proxy headers (Vercel sets these).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
