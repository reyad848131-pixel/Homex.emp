// Reads the per-item add-on breakdown (glass, lighting, island…) that the quote
// builders store inside each item's `details` JSON. Used by every surface that
// shows a quote to staff or the customer (PDF, online view, review screen) so
// the breakdown renders identically everywhere.
//
// Hidden surcharges (cabinet handles, kitchen base surcharge) are never part of
// this list — the builders fold them silently into the base and never emit them.

export type ExtraLineView = { label: string; qty: number; unitPrice: number; total: number };

// `details` may arrive as a parsed object (client state) or a JSON string (DB).
export function itemExtraLines(details: unknown): ExtraLineView[] {
  if (details == null) return [];
  let d: any = details;
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch { return []; }
  }
  const arr = d && d.extrasBreakdown;
  if (!Array.isArray(arr)) return [];
  const out: ExtraLineView[] = [];
  for (const x of arr) {
    if (x && typeof x.label === "string" && Number.isFinite(Number(x.total))) {
      out.push({
        label: x.label,
        qty: Number(x.qty) || 0,
        unitPrice: Number(x.unitPrice) || 0,
        total: Number(x.total) || 0,
      });
    }
  }
  return out;
}

export function extraLinesSum(lines: { total: number }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.total, 0) * 1000) / 1000;
}
