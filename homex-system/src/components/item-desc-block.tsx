"use client";

import { parseItemDesc } from "@/lib/item-desc";

// Structured, readable rendering of an item's description (see parseItemDesc):
// a bold title with measurements, the accessories as highlighted chips, and the
// remaining attributes as compact tags. Used anywhere an item is shown.
export function ItemDescBlock({ text, compact }: { text: string; compact?: boolean }) {
  const { title, accessories, others } = parseItemDesc(text);
  if (!title && accessories.length === 0 && others.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {title && <div className={compact ? "font-bold text-sm leading-snug" : "font-bold text-gray-900 dark:text-white leading-snug"}>{title}</div>}
      {accessories.map((a, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">{a.label}:</span>
          {a.values.map((v, j) => (
            <span key={j} className="text-[11px] font-semibold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-full px-2 py-0.5">{v}</span>
          ))}
        </div>
      ))}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {others.map((o, i) => (
            <span key={i} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60 rounded-full px-2 py-0.5">{o}</span>
          ))}
        </div>
      )}
    </div>
  );
}
