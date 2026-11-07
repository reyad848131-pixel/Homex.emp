"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Check, Trash2, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ItemVersion, VersionableItem } from "@/lib/item-versions";

// A compact navigator shown inside a line-item card once the item has more than
// one version. The user browses versions with the arrows (preview only — the
// quote total does NOT change while browsing) and presses "Use this version" to
// approve the one they want. Any version can be deleted (at least one is kept).
export function ItemVersionBar({
  item,
  fmtCur,
  onApprove,
  onDelete,
}: {
  item: VersionableItem;
  fmtCur: (n: number) => string;
  onApprove: (idx: number) => void;
  onDelete: (idx: number) => void;
}) {
  const { t, locale } = useI18n();
  const versions = item.versions || [];
  const active = item.activeVersion ?? versions.length - 1;
  const [preview, setPreview] = useState(active);

  // Snap the preview back to the approved version whenever the history changes
  // (after approving, deleting, or a new edit is pushed). Adjusting state during
  // render is React's recommended pattern here — no effect needed.
  const sig = `${active}:${versions.length}`;
  const [lastSig, setLastSig] = useState(sig);
  if (sig !== lastSig) {
    setLastSig(sig);
    setPreview(active);
  }

  if (versions.length < 2) return null;

  const idx = Math.min(Math.max(0, preview), versions.length - 1);
  const v: ItemVersion | undefined = versions[idx];
  if (!v) return null;
  const isApproved = idx === active;
  const when = new Date(v.at).toLocaleTimeString(locale === "en" ? "en-GB" : "ar", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-2 py-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <History className="w-3.5 h-3.5 text-gray-400 shrink-0" />

        {/* older */}
        <button
          type="button"
          onClick={() => setPreview((p) => Math.max(0, p - 1))}
          disabled={idx === 0}
          aria-label={t("verOlder")}
          className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 disabled:opacity-30 hover:text-gray-900 dark:hover:text-white">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 font-mono-en whitespace-nowrap">
          {t("verVersion")} {idx + 1}/{versions.length}
        </span>

        {/* newer */}
        <button
          type="button"
          onClick={() => setPreview((p) => Math.min(versions.length - 1, p + 1))}
          disabled={idx === versions.length - 1}
          aria-label={t("verNewer")}
          className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 disabled:opacity-30 hover:text-gray-900 dark:hover:text-white">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="text-[11px] text-gray-400 font-mono-en whitespace-nowrap">{when}</span>
        <span className="text-xs font-bold font-mono-en text-gray-700 dark:text-gray-200 whitespace-nowrap">
          {fmtCur(v.lineTotal)}
        </span>

        <div className="ms-auto flex items-center gap-1">
          {isApproved ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Check className="w-3 h-3" /> {t("verApproved")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onApprove(idx)}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700">
              <Check className="w-3 h-3" /> {t("verApprove")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(idx)}
            aria-label={t("verDelete")}
            title={t("verDelete")}
            className="p-1 rounded text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* A short line showing how the previewed version differs from the one in use. */}
      {!isApproved && (
        <p className="text-[10px] text-gray-400 mt-1 ps-6 font-mono-en">
          {t("verInUse")}: {fmtCur(versions[active]?.lineTotal ?? item.lineTotal)}
        </p>
      )}
    </div>
  );
}
