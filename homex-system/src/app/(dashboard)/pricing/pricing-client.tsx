"use client";

import { useEffect, useState } from "react";
import { Tag, Save, Loader2, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { DEFAULT_PRICING, BED_SIZE_KEYS, KITCHEN_REGION_KEYS, type PricingConfig } from "@/lib/pricing";

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
  const setCurtain = (k: keyof PricingConfig["curtains"], n: number) =>
    setP((prev) => ({ ...prev, curtains: { ...prev.curtains, [k]: n } }));
  const setClad = (k: keyof PricingConfig["cladding"], n: number) =>
    setP((prev) => ({ ...prev, cladding: { ...prev.cladding, [k]: n } }));
  const setNight = (k: "round" | "standard", n: number) =>
    setP((prev) => ({ ...prev, nightstand: { ...prev.nightstand, [k]: n } }));
  const setKitchenBase = (region: string, n: number) =>
    setP((prev) => ({ ...prev, kitchen: { ...prev.kitchen, base: { ...prev.kitchen.base, [region]: n } } }));
  const setRate = (id: string, n: number) =>
    setP((prev) => ({ ...prev, rates: { ...prev.rates, [id]: n } }));
  const addAccessory = () =>
    setP((prev) => ({ ...prev, kitchen: { ...prev.kitchen, accessories: [...prev.kitchen.accessories, { id: `acc-${Date.now().toString(36)}`, name: "", price: 0 }] } }));
  const updateAccessory = (i: number, patch: Partial<{ name: string; price: number }>) =>
    setP((prev) => ({ ...prev, kitchen: { ...prev.kitchen, accessories: prev.kitchen.accessories.map((a, idx) => idx === i ? { ...a, ...patch } : a) } }));
  const removeAccessory = (i: number) =>
    setP((prev) => ({ ...prev, kitchen: { ...prev.kitchen, accessories: prev.kitchen.accessories.filter((_, idx) => idx !== i) } }));

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

      {/* Kitchens & pantry — per-region base rate + porcelain */}
      <div className={card}>
        <h2 className="text-base font-bold mb-1">{t("pricingKitchen")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("pricingBedHint")}</p>
        <div className="mb-4">
          <PriceField label={t("pricingPorcelain")} value={p.kitchen.porcelain}
            onChange={(n) => setP((prev) => ({ ...prev, kitchen: { ...prev.kitchen, porcelain: n } }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {KITCHEN_REGION_KEYS.map((region) => (
            <PriceField key={region} label={region} value={p.kitchen.base[region] ?? 0}
              onChange={(n) => setKitchenBase(region, n)} />
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-bold mb-3">{t("pricingAccessories")}</h3>
          <div className="space-y-2">
            {p.kitchen.accessories.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <input value={a.name} onChange={(e) => updateAccessory(i, { name: e.target.value })}
                  placeholder={t("pricingAccName")} className="field flex-1 text-sm" />
                <input type="number" min={0} step={1} value={a.price}
                  onChange={(e) => updateAccessory(i, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="field font-mono-en text-center w-24 shrink-0" />
                <button type="button" onClick={() => removeAccessory(i)}
                  className="w-9 h-9 shrink-0 grid place-items-center rounded-lg border border-gray-200 dark:border-gray-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="delete">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAccessory}
            className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <Plus className="w-4 h-4" /> {t("pricingAddAccessory")}
          </button>
        </div>
      </div>

      {/* Curtains */}
      <div className={card}>
        <h2 className="text-base font-bold mb-4">{t("pricingCurtains")}</h2>
        <div className="space-y-3">
          <PriceField label={t("chiffonOnly")} value={p.curtains.chiffon} onChange={(n) => setCurtain("chiffon", n)} />
          <PriceField label={t("blackoutType")} value={p.curtains.blackout} onChange={(n) => setCurtain("blackout", n)} />
          <PriceField label={t("chiffonBlackout")} value={p.curtains.combo} onChange={(n) => setCurtain("combo", n)} />
          <PriceField label="Roll" value={p.curtains.roll} onChange={(n) => setCurtain("roll", n)} />
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <PriceField label={t("pricingMotorBase")} value={p.curtains.motorBase} onChange={(n) => setCurtain("motorBase", n)} />
            <PriceField label={t("pricingMotorPerMeter")} value={p.curtains.motorPerMeter} onChange={(n) => setCurtain("motorPerMeter", n)} />
          </div>
        </div>
      </div>

      {/* Cladding */}
      <div className={card}>
        <h2 className="text-base font-bold mb-4">{t("pricingCladding")}</h2>
        <div className="space-y-3">
          <PriceField label={t("pricingCladMilamin")} value={p.cladding.milamin} onChange={(n) => setClad("milamin", n)} />
          <PriceField label={t("pricingCladChip")} value={p.cladding.chipboard} onChange={(n) => setClad("chipboard", n)} />
          <PriceField label={t("pricingLightUnit")} value={p.cladding.light} onChange={(n) => setClad("light", n)} />
        </div>
      </div>

      {/* Nightstand */}
      <div className={card}>
        <h2 className="text-base font-bold mb-4">{t("pricingNightstand")}</h2>
        <div className="space-y-3">
          <PriceField label={t("roundType")} value={p.nightstand.round} onChange={(n) => setNight("round", n)} />
          <PriceField label={t("standardType")} value={p.nightstand.standard} onChange={(n) => setNight("standard", n)} />
        </div>
      </div>

      {/* Other simple per-unit rates */}
      <div className={card}>
        <h2 className="text-base font-bold mb-4">{t("pricingOtherRates")}</h2>
        <div className="space-y-3">
          <PriceField label={t("pricingRatePartition")} value={p.rates.partition} onChange={(n) => setRate("partition", n)} />
          <PriceField label={t("pricingRateLaundry")} value={p.rates.laundry} onChange={(n) => setRate("laundry", n)} />
          <PriceField label={t("pricingRateDressing")} value={p.rates["dressing-table"]} onChange={(n) => setRate("dressing-table", n)} />
          <PriceField label={t("pricingRateStudy")} value={p.rates["study-table"]} onChange={(n) => setRate("study-table", n)} />
          <PriceField label={t("pricingRateTvSqm")} value={p.rates["tv-table"]} onChange={(n) => setRate("tv-table", n)} />
          <PriceField label={t("pricingRateTvMeter")} value={p.rates["tv-table-meter"]} onChange={(n) => setRate("tv-table-meter", n)} />
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
