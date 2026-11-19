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
      // Safety net: the 18mm back panel is a hidden surcharge and must never be
      // shown to the customer. New quotes no longer emit it, but older/recently
      // saved quotes may still carry it in their stored breakdown — drop it here.
      if (x.label.startsWith("خلفية")) continue;
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

// Strip the hidden "خلفية ١٨ملي …" segment from an item description before it is
// shown to the CUSTOMER (PDF / online). The back panel is a silent surcharge;
// new quotes no longer put it in the description, but older quotes may.
export function hideBackPanelFromDesc(desc: string): string {
  if (!desc) return desc;
  return desc
    .replace(/\s*·\s*خلفية\s*١٨\s*ملي[^·]*/g, "")
    .replace(/^خلفية\s*١٨\s*ملي[^·]*·\s*/g, "")
    .trim();
}

export function extraLinesSum(lines: { total: number }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.total, 0) * 1000) / 1000;
}

// A plain amount with no trailing zeros (60.000 → "60", 60.5 → "60.5"), in
// ASCII digits — used for the compact inline add-ons line, suffixed with " OMR"
// so it is unmistakably a price.
export function plainAmount(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

// One add-on rendered inline, e.g. "إضاءة LED ×2 50 OMR" (×count shown only
// when more than one).
export function extraInlineText(l: ExtraLineView): string {
  const qty = l.qty > 1 ? ` ×${l.qty}` : "";
  return `${l.label}${qty} ${plainAmount(l.total)} OMR`;
}
