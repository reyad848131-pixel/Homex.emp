"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";

// Quality-control verdict on an item (pass / fail), set by the foreman/owner
// before delivery. Others see the verdict read-only.
export function ItemQcPanel({ itemId, canEdit, initial }: {
  itemId: string; canEdit: boolean; initial: { status: string | null; note: string | null; at: string | null };
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState(initial.status);
  const [note, setNote] = useState(initial.note || "");
  const [busy, setBusy] = useState(false);

  const save = async (next: string | null) => {
    setBusy(true);
    const res = await fetch("/api/item-qc", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, qcStatus: next, qcNote: note }) });
    if (res.ok) setStatus(next); else toast.error(t("saveFailed"));
    setBusy(false);
  };

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> {t("qcTitle")}</h2>
      {!canEdit ? (
        status === "pass" ? <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600"><CheckCircle2 className="w-4 h-4" /> {t("qcPass")}</span>
        : status === "fail" ? <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600"><XCircle className="w-4 h-4" /> {t("qcFail")}</span>
        : <span className="text-xs text-gray-400">{t("qcPending")}</span>
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={() => save(status === "pass" ? null : "pass")} disabled={busy}
              className={cn("flex-1 h-10 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-1.5 border", status === "pass" ? "bg-green-600 text-white border-green-600" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20")}>
              <ShieldCheck className="w-4 h-4" /> {t("qcPass")}
            </button>
            <button onClick={() => save(status === "fail" ? null : "fail")} disabled={busy}
              className={cn("flex-1 h-10 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-1.5 border", status === "fail" ? "bg-red-600 text-white border-red-600" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20")}>
              <ShieldX className="w-4 h-4" /> {t("qcFail")}
            </button>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => status && save(status)} placeholder={t("qcNotePlaceholder")} className="field w-full mt-2 h-9 text-sm" />
        </>
      )}
    </div>
  );
}
