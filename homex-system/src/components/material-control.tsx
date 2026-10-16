"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";

// Wood/fabric procurement control for an ORDER (quote-level). The foreman sets
// it (لم تُطلب / تم الطلب / وصلت) from the production page or an item's barcode
// page; إدارة الأعمال only views it. Both pages share this one control.
const MAT_OPTS: { key: string; label: string; on: string }[] = [
  { key: "not_ordered", label: "لم تُطلب", on: "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-100" },
  { key: "ordered", label: "تم الطلب", on: "bg-sky-500 text-white" },
  { key: "arrived", label: "وصلت", on: "bg-green-600 text-white" },
];

function MatRow({ label, value, onSet }: { label: string; value: string; onSet: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-gray-500 w-12 shrink-0">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {MAT_OPTS.map((o) => (
          <button key={o.key} onClick={() => onSet(o.key)}
            className={cn("px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors",
              value === o.key ? `${o.on} border-transparent` : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700")}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MaterialControl({ quoteId, wood, fabric }: { quoteId: string; wood: string; fabric: string }) {
  const toast = useToast();
  const [w, setW] = useState(wood);
  const [f, setF] = useState(fabric);
  const save = async (patch: { woodStatus?: string; fabricStatus?: string }) => {
    const res = await fetch("/api/foreman/materials", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quotationId: quoteId, ...patch }) });
    if (!res.ok) toast.error("تعذّر الحفظ");
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500"><Package className="w-3.5 h-3.5" /> طلب المواد (الأخشاب / الأقمشة)</div>
      <MatRow label="الأخشاب" value={w} onSet={(v) => { setW(v); save({ woodStatus: v }); }} />
      <MatRow label="الأقمشة" value={f} onSet={(v) => { setF(v); save({ fabricStatus: v }); }} />
    </div>
  );
}
