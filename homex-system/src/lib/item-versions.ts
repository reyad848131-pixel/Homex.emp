// Per-line-item version history for the quote builder.
//
// Every time a line item is edited and the edit is confirmed, the previous
// state is kept as a "version" so the user can navigate back and forth between
// versions and re-approve an older one — without ever losing the numbers.
//
// IMPORTANT: this module is pure metadata. It never computes or alters prices.
// The approved version's values are always mirrored onto the item's own
// top-level fields (description/details/quantity/unitPrice/extras/lineTotal),
// so every existing consumer (totals, PDF, save payload) keeps working exactly
// as before and the money path (quote-calc) is untouched.

export interface ItemVersion {
  description: string;
  details: Record<string, unknown>;
  quantity: number;
  unitPrice: number;
  extras: number;
  lineTotal: number;
  at: number; // when this version was captured (ms epoch)
}

// The minimal shape this module needs from a line item.
export interface VersionableItem {
  description: string;
  details: Record<string, unknown>;
  quantity: number;
  unitPrice: number;
  extras: number;
  lineTotal: number;
  versions?: ItemVersion[];
  activeVersion?: number;
}

const clone = (d: Record<string, unknown> | undefined | null): Record<string, unknown> =>
  d ? JSON.parse(JSON.stringify(d)) : {};

// Capture the item's current values as a version snapshot.
export function snapshot(it: VersionableItem): ItemVersion {
  return {
    description: it.description,
    details: clone(it.details),
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    extras: it.extras,
    lineTotal: it.lineTotal,
    at: Date.now(),
  };
}

// Guarantee the item carries at least one version (seeded from its current
// values). Safe to call on items loaded without any history.
export function ensureVersions<T extends VersionableItem>(it: T): T {
  if (it.versions && it.versions.length > 0) {
    return { ...it, activeVersion: clampActive(it.activeVersion, it.versions.length) };
  }
  return { ...it, versions: [snapshot(it)], activeVersion: 0 };
}

// Append the item's current values as a NEW version and make it the approved
// one. Use this right after an edit is confirmed.
export function pushVersion<T extends VersionableItem>(it: T): T {
  const base = ensureVersions(it);
  const versions = [...(base.versions as ItemVersion[]), snapshot(it)];
  return { ...it, versions, activeVersion: versions.length - 1 };
}

// Approve a version: mirror its stored values back onto the item's top-level
// fields so it becomes the one that counts in the quote.
export function applyVersion<T extends VersionableItem>(it: T, idx: number): T {
  const versions = it.versions || [];
  const v = versions[idx];
  if (!v) return it;
  return {
    ...it,
    description: v.description,
    details: clone(v.details),
    quantity: v.quantity,
    unitPrice: v.unitPrice,
    extras: v.extras,
    lineTotal: v.lineTotal,
    activeVersion: idx,
  };
}

// Remove a version. At least one version is always kept. If the approved
// version is removed, approval moves to a neighbour and the item's fields are
// re-mirrored from it.
export function removeVersion<T extends VersionableItem>(it: T, idx: number): T {
  const base = ensureVersions(it);
  const versions = [...(base.versions as ItemVersion[])];
  if (versions.length <= 1 || idx < 0 || idx >= versions.length) return base;
  const wasActive = (base.activeVersion ?? versions.length - 1);
  versions.splice(idx, 1);
  let active = wasActive;
  if (idx === wasActive) active = Math.min(idx, versions.length - 1);
  else if (idx < wasActive) active = wasActive - 1;
  return applyVersion({ ...base, versions, activeVersion: active }, active);
}

function clampActive(active: number | undefined, len: number): number {
  if (active == null || !Number.isFinite(active)) return len - 1;
  return Math.min(Math.max(0, active), len - 1);
}
