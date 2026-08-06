// Shared constants for the worker-productivity feature.

// Default production stages a factory item passes through. Used as quick-pick
// chips when adding a stage to an item; a custom stage name is also allowed.
export const DEFAULT_STAGES = [
  "نجارة",
  "قص وتفصيل",
  "دهان",
  "تنجيد",
  "تجميع",
  "تلميع",
  "تغليف",
] as const;

// A fixed palette of distinct, legible worker-identity colours (used for the
// avatar chip on the board and in reports). New workers cycle through these.
export const WORKER_COLORS = [
  "#2dd4bf", // teal
  "#a78bfa", // violet
  "#fbbf24", // amber
  "#fb7185", // rose
  "#38bdf8", // sky
  "#a3e635", // lime
  "#fb923c", // orange
  "#f472b6", // pink
  "#4ade80", // green
  "#818cf8", // indigo
] as const;

// Pick the next colour for a new worker, avoiding ones already in use where
// possible so the team stays visually distinct.
export function nextWorkerColor(used: string[]): string {
  const free = WORKER_COLORS.find((c) => !used.includes(c));
  return free || WORKER_COLORS[used.length % WORKER_COLORS.length];
}

// First one or two letters of a name → avatar initials (Arabic-friendly).
export function initials(name: string): string {
  const n = (name || "").trim();
  if (!n) return "؟";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[1][0] || "");
}
