"use client";

import { useEffect, useState } from "react";
import { Tag, Save, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { DEFAULT_PRICING, BED_SIZE_KEYS, type PricingConfig } from "@/lib/pricing";

// A labelled numeric price input (3-decimal OMR).
function PriceField({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      <input
        type="number" min={0} step={1} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        className="field font-mono-en text-center w-28 shrink-0"
      />
    </label>
  );
}

export default function PricingClient() {
  const { t } = useI18n();
  const toast = useToast();
  const [p, setP] = useState<PricingConfig>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setP(d as PricingConfig); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setP(data as PricingConfig); toast.success(t("pricingSaved")); }
      else toast.error(data.error || t("saveFailed"));
    } catch {
      toast.error(t("serverConnectionError"));
    } finally {
      setSaving(false);
    }
  };

  const setBed = (frame: "wood" | "fabric", size: string, n: number) =>
    setP((prev) => ({ ...prev, bed: { ...prev.bed, [frame]: { ...prev.bed[frame], [size]: n } } }));

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> …</div>;
  }

  const card = "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5";

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5 pb-28">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 grid place-items-center text-teal-600 shrink-0">
          <Tag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("pricingTitle")}</h1>
          <p className="text-sm text-gray-500">{t("pricingSubtitle")}</p>
        </div>
      </div>

      {/* Cabinets — per-metre rate */}
      <div className={card}>
        <h2 className="text-base font-bold mb-4">{t("pricingCabinets")}</h2>
        <PriceField label={t("pricingPerMeter")} value={p.cabinets.perMeter}
          onChange={(n) => setP((prev) => ({ ...prev, cabinets: { perMeter: n } }))} />
      </div>

      {/* Seating sets — per piece + wooden surcharge */}
      <div className={card}>
        <h2 className="text-base font-bold mb-4">{t("pricingSofa")}</h2>
        <div className="space-y-3">
          <PriceField label={t("sofaSingle")} value={p.sofa.single}
            onChange={(n) => setP((prev) => ({ ...prev, sofa: { ...prev.sofa, single: n } }))} />
          <PriceField label={t("sofaDouble")} value={p.sofa.double}
            onChange={(n) => setP((prev) => ({ ...prev, sofa: { ...prev.sofa, double: n } }))} />
          <PriceField label={t("sofaTriple")} value={p.sofa.triple}
            onChange={(n) => setP((prev) => ({ ...prev, sofa: { ...prev.sofa, triple: n } }))} />
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <PriceField label={`${t("woodenType")} (${t("pricingSurchargePerPiece")})`} value={p.sofa.woodenSurcharge}
              onChange={(n) => setP((prev) => ({ ...prev, sofa: { ...prev.sofa, woodenSurcharge: n } }))} />
          </div>
        </div>
      </div>

      {/* Beds — price per frame type × size */}
      <div className={card}>
        <h2 className="text-base font-bold mb-1">{t("pricingBeds")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("pricingBedHint")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {(["wood", "fabric"] as const).map((frame) => (
            <div key={frame}>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
                {frame === "wood" ? t("woodType") : t("fabricType")}
              </h3>
              <div className="space-y-2.5">
                {BED_SIZE_KEYS.map((size) => (
                  <PriceField key={size} label={size} value={p.bed[frame]?.[size] ?? 0}
                    onChange={(n) => setBed(frame, size, n)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 lg:ps-64 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 p-3 no-print">
        <div className="max-w-3xl mx-auto flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:opacity-90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
