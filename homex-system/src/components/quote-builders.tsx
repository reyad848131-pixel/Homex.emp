"use client";

// Shared category-specific price builders used by both the create
// (quotations/new) and edit (quotations/[id]/edit) pages. Extracted here so the
// pricing logic lives in one place instead of being duplicated across two files.

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { curtainMinCount } from "@/lib/order-rules";

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  pricingType: string;
  basePrice: number | null;
  config: any;
}

const KITCHEN_BASE_PRICES: Record<string, number | Record<string, number> | null> = {
  "مسقط": 130,
  "ظفار": null,
  "مسندم": null,
  "البريمي": 150,
  "الداخلية": { _default: 125, "بهلاء": 120, "نزوى": 120, "الحمراء": 120 },
  "شمال الباطنة": 135,
  "جنوب الباطنة": 135,
  "جنوب الشرقية": 140,
  "شمال الشرقية": 140,
  "الظاهرة": 135,
  "الوسطى": null,
};

export function getKitchenBasePrice(governorate: string, wilayat: string): number | null {
  const entry = KITCHEN_BASE_PRICES[governorate];
  if (entry === null || entry === undefined) return null;
  if (typeof entry === "number") return entry;
  return entry[wilayat] ?? entry._default ?? null;
}

function KitchenBuilder({ config, governorate, wilayat, onUpdate }: { config: any; governorate: string; wilayat: string; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [length, setLength] = useState(4);
  const [unitType, setUnitType] = useState<"2unit" | "3unit">("2unit");
  const [island, setIsland] = useState<"none" | "small" | "large">("none");
  const [manualBase, setManualBase] = useState(130);

  const PORCELAIN_PRICE = config?.porcelainSurcharge || 55;
  const unitMultiplier = unitType === "3unit" ? 3 : 2;
  const autoBase = getKitchenBasePrice(governorate, wilayat);
  const isManual = autoBase === null;
  const basePrice = isManual ? manualBase : autoBase;
  const pricePerSqm = (basePrice * unitMultiplier) + PORCELAIN_PRICE;
  const area = Math.round(length * 100) / 100;

  const ISLAND_PRICES = { small: config?.island?.small || 390, large: config?.island?.large || 600 };

  useEffect(() => {
    const price = area * pricePerSqm;
    const extras = island !== "none" ? ISLAND_PRICES[island] : 0;
    const unitLabel = unitType === "3unit" ? t("unit3Label") : t("unit2Label");
    const desc = `مطبخ MDF - ${unitLabel} - ${length}م`;
    onUpdate(desc, price, extras);
  }, [length, unitType, island, basePrice, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("kitchenDimensions")}</label>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{t("lengthM")}</span>
          <span className="text-xs font-mono-en font-bold">{length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={2} max={15} step={1} value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
          <input type="number" min={2} max={15} step={1} value={length}
            onChange={(e) => setLength(Math.min(15, Math.max(2, parseInt(e.target.value) || 2)))}
            className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
        </div>
        <div className="mt-2 text-center py-2 bg-gray-50 rounded border border-gray-100">
          <span className="text-sm text-gray-600">{t("areaLabel")}: </span>
          <span className="font-bold font-mono-en text-gray-900">{area.toFixed(2)}</span>
          <span className="text-sm text-gray-600"> {t("sqmUnit")}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("unitTypeKitchen")}</label>
        <div className="flex gap-2">
          {([["2unit", t("unit2Label")], ["3unit", t("unit3Label")]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setUnitType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                unitType === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {isManual && (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("pricePerMeterLabel")} (OMR)</label>
          <input type="number" step={1} min={1} value={manualBase}
            onChange={(e) => setManualBase(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          <p className="text-xs text-amber-600 mt-1">{governorate}: {t("manualPriceHint")}</p>
        </div>
      )}

      <div className="text-center py-2 bg-gray-50 rounded border border-gray-100">
        <p className="text-xs text-gray-500">
          {wilayat || governorate}: {basePrice} × {unitMultiplier} + {PORCELAIN_PRICE} ({t("porcelain")}) = <span className="font-bold font-mono-en">{pricePerSqm.toFixed(3)}</span> {t("omrPerSqm")}
        </p>
        <p className="text-sm font-bold font-mono-en text-gray-900 mt-1">{t("pricePerMeterLabel")} (OMR) {pricePerSqm.toFixed(3)}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("additionalIsland")}</label>
        <div className="flex gap-2">
          {([
            ["none", t("noIsland")],
            ["small", `${t("smallIsland")} (${ISLAND_PRICES.small})`],
            ["large", `${t("largeIsland")} (${ISLAND_PRICES.large})`],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setIsland(k as "none" | "small" | "large")}
              className={cn("flex-1 py-2 rounded text-xs font-bold border transition-colors",
                island === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
        {island !== "none" && (
          <p className="text-xs text-emerald-600 mt-1">
            {island === "large" ? t("largeIsland") : t("smallIsland")}: {ISLAND_PRICES[island].toFixed(3)} {t("omr")} ({t("addedAsExtras")})
          </p>
        )}
      </div>
    </div>
  );
}

function CabinetBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [width, setWidth] = useState(1.5);
  const [height, setHeight] = useState(2.4);
  const [shape, setShape] = useState("single");
  const [glassDoors, setGlassDoors] = useState(0);
  const [leds, setLeds] = useState(0);

  useEffect(() => {
    const area = width * height;
    const price = area * (config.basePrice || 54);
    const extras = glassDoors * (config.glassDoor || 60) + leds * (config.led || 25);
    const desc = `خزانة ${shape === "L" ? "L" : shape === "U" ? "U" : "عادية"} - ${width}×${height}م`;
    onUpdate(desc, price, extras);
  }, [width, height, shape, glassDoors, leds, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("shapeLabel")}</label>
        <div className="flex gap-2">
          {[["single", t("regularShape")], ["L", t("lShape")], ["U", t("uShape")]].map(([k, l]) => (
            <button key={k} onClick={() => setShape(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                shape === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("widthM")}</label>
          <input type="number" step={0.1} min={0.5} value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0.5)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("heightM")}</label>
          <input type="number" step={0.1} min={0.5} value={height} onChange={(e) => setHeight(parseFloat(e.target.value) || 0.5)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("glassDoors")} ({config.glassDoor || 60} {t("perDoor")})</label>
          <input type="number" min={0} value={glassDoors} onChange={(e) => setGlassDoors(parseInt(e.target.value) || 0)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("ledLighting")} ({config.led || 25} {t("omr")})</label>
          <input type="number" min={0} value={leds} onChange={(e) => setLeds(parseInt(e.target.value) || 0)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      </div>
    </div>
  );
}

function CurtainBuilder({ config, wilayat, onUpdate }: { config: any; wilayat: string; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const minCount = curtainMinCount(wilayat);
  const [type, setType] = useState("chiffon");
  const [motor, setMotor] = useState<"manual" | "electric">("manual");
  const [count, setCount] = useState(minCount);
  const [width, setWidth] = useState(2);
  const [height, setHeight] = useState(2);

  // Keep the count at or above the wilayat minimum (e.g. if the wilayat changes).
  useEffect(() => {
    setCount((c) => Math.max(c, minCount));
  }, [minCount]);

  const TYPES: Record<string, { label: string; price: number }> = {
    chiffon: { label: t("chiffonOnly"), price: 9 },
    blackout: { label: t("blackoutType"), price: 9 },
    combo: { label: t("chiffonBlackout"), price: 12.5 },
    roll: { label: "Roll", price: 15 },
  };

  const MOTOR_BASE = config?.electricMotor?.base || 50;
  const MOTOR_PER_METER = config?.electricMotor?.perMeter || 7.5;

  const area = Math.round(width * height * 100) / 100;
  const motorQty = type === "combo" ? 2 : 1;
  const motorSurcharge = motor === "electric" ? (MOTOR_BASE + MOTOR_PER_METER * width) * motorQty : 0;

  useEffect(() => {
    const pricePerSqm = TYPES[type]?.price || 9;
    const price = area * pricePerSqm;
    const desc = `ستائر ${TYPES[type]?.label} (${count} ستارة) - ${width}×${height}م = ${area} م²`;
    onUpdate(desc, price, motorSurcharge);
  }, [type, motor, count, width, height, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("curtainType")}</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {v.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{TYPES[type]?.label}: {TYPES[type]?.price.toFixed(3)} {t("omrPerSqm")}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("operationMethod")}</label>
        <div className="flex gap-2">
          {([["manual", t("manualOp")], ["electric", t("electricOp")]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMotor(k as "manual" | "electric")}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                motor === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
        {motor === "electric" && (
          <p className="text-xs text-emerald-600 mt-1">
            {t("motorLabel")}: ({MOTOR_BASE} + {MOTOR_PER_METER} × {width}{t("mUnit")} = {(MOTOR_BASE + MOTOR_PER_METER * width).toFixed(3)})
            {motorQty > 1 && ` × ${motorQty} ${t("motorLabel")}`} = {motorSurcharge.toFixed(3)} {t("omr")}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("curtainCount")}</label>
        <input type="number" min={minCount} step={1} value={count}
          onChange={(e) => setCount(Math.max(minCount, parseInt(e.target.value) || minCount))}
          className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        <p className="text-xs text-amber-600 mt-1 font-semibold">{t("curtainMinPrefix")}: {minCount} {t("curtainsUnit")}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("curtainDimensions")}</label>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{t("widthM")}</span>
              <span className="text-xs font-mono-en font-bold">{width}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={20} step={1} value={width}
                onChange={(e) => setWidth(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
              <input type="number" min={1} max={20} step={1} value={width}
                onChange={(e) => setWidth(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{t("heightM")}</span>
              <span className="text-xs font-mono-en font-bold">{height}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={20} step={1} value={height}
                onChange={(e) => setHeight(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
              <input type="number" min={1} max={20} step={1} value={height}
                onChange={(e) => setHeight(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
            </div>
          </div>
        </div>
        <div className="mt-2 text-center py-2 bg-gray-50 rounded border border-gray-100">
          <span className="text-sm text-gray-600">{t("areaLabel")}: </span>
          <span className="font-bold font-mono-en text-gray-900">{area.toFixed(2)}</span>
          <span className="text-sm text-gray-600"> {t("sqmUnit")}</span>
        </div>
      </div>
    </div>
  );
}

const BED_PRICES: Record<string, Record<string, number>> = {
  wood:   { "90x190": 120, "100x200": 130, "120x200": 135, "180x200": 390, "200x200": 400, "220x220": 410 },
  fabric: { "90x190": 125, "100x200": 135, "120x200": 140, "180x200": 420, "200x200": 430, "220x220": 450 },
};
const BED_SIZES = ["90x190", "100x200", "120x200", "180x200", "200x200", "220x220"];

function BedBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [type, setType] = useState("wood");
  const [size, setSize] = useState("180x200");
  const [lighting, setLighting] = useState(false);
  const [wantsLegs, setWantsLegs] = useState(false);

  useEffect(() => {
    const price = BED_PRICES[type]?.[size] || 160;
    const extras = lighting ? (config.lighting || 20) : 0;
    const typeLabel = type === "wood" ? "خشب" : "قماش";
    // "مع أرجل" is informational only — it never changes price or extras.
    const desc = `سرير ${typeLabel} - ${size} سم${wantsLegs ? " - مع أرجل" : ""}`;
    onUpdate(desc, price, extras);
  }, [type, size, lighting, wantsLegs, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("typeLabel")}</label>
        <div className="flex gap-2">
          {([["wood", t("woodType")], ["fabric", t("fabricType")]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("sizeLabel")}</label>
        <div className="grid grid-cols-3 gap-2">
          {BED_SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className={cn("py-2 rounded text-xs font-bold border transition-colors",
                size === s ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {s}
              <span className="block text-[10px] font-mono-en mt-0.5">{BED_PRICES[type]?.[s]} {t("omr")}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={lighting} onChange={(e) => setLighting(e.target.checked)} className="rounded" />
        {t("lightingLabel")} (+{config.lighting || 20} {t("omr")})
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={wantsLegs} onChange={(e) => setWantsLegs(e.target.checked)} className="rounded" />
        {t("bedLegsLabel")}
      </label>
    </div>
  );
}

function CladdingBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [type, setType] = useState("type1");
  const [width, setWidth] = useState(3);
  const [height, setHeight] = useState(2.4);
  const [lighting, setLighting] = useState(false);
  const [lightCount, setLightCount] = useState(1);

  const TYPES: Record<string, { label: string; price: number }> = {
    type1: { label: "Milamin", price: config?.types?.type1 || 45 },
    type2: { label: t("chipboardAlt"), price: config?.types?.type2 || 27 },
  };
  const LIGHT_PRICE = config?.lightPrice || 20;

  const area = Math.round(width * height * 100) / 100;
  const lightSurcharge = lighting ? lightCount * LIGHT_PRICE : 0;

  useEffect(() => {
    const pricePerSqm = TYPES[type]?.price || 45;
    const price = area * pricePerSqm;
    const desc = `كلادينج ${TYPES[type]?.label} - ${width}×${height}م = ${area} م²`;
    onUpdate(desc, price, lightSurcharge);
  }, [type, width, height, lighting, lightCount, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("claddingType")}</label>
        <div className="flex gap-2">
          {Object.entries(TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {v.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{TYPES[type]?.label}: {TYPES[type]?.price.toFixed(3)} {t("omrPerSqm")}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("dimensionsLabel")}</label>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{t("widthM")}</span>
              <span className="text-xs font-mono-en font-bold">{width}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={10} step={0.1} value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
              <input type="number" min={1} max={10} step={0.1} value={width}
                onChange={(e) => setWidth(Math.min(10, Math.max(1, parseFloat(e.target.value) || 1)))}
                className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{t("heightM")}</span>
              <span className="text-xs font-mono-en font-bold">{height}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={10} step={0.1} value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
              <input type="number" min={1} max={10} step={0.1} value={height}
                onChange={(e) => setHeight(Math.min(10, Math.max(1, parseFloat(e.target.value) || 1)))}
                className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
            </div>
          </div>
        </div>
        <div className="mt-2 text-center py-2 bg-gray-50 rounded border border-gray-100">
          <span className="text-sm text-gray-600">{t("areaLabel")}: </span>
          <span className="font-bold font-mono-en text-gray-900">{area.toFixed(2)}</span>
          <span className="text-sm text-gray-600"> {t("sqmUnit")}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("lightingLabel")}</label>
        <div className="flex gap-2">
          {([["none", t("withoutLighting")], ["with", t("withLighting")]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setLighting(k === "with")}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                (lighting ? "with" : "none") === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
        {lighting && (
          <div className="mt-2">
            <label className="block text-xs text-gray-500 mb-1">{t("lightPointsCount")}</label>
            <input type="number" min={1} step={1} value={lightCount}
              onChange={(e) => setLightCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono-en text-center" />
            <p className="text-xs text-emerald-600 mt-1">
              {lightCount} × {LIGHT_PRICE.toFixed(3)} {t("omr")} = {lightSurcharge.toFixed(3)} {t("omr")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SofaBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [type, setType] = useState("standard");
  const [price, setPrice] = useState(config.standard?.min || 80);

  useEffect(() => {
    const typeLabel = type === "wooden" ? t("woodenType") : t("standardType");
    const desc = `طقم جلوس ${typeLabel}`;
    onUpdate(desc, price, 0);
  }, [type, price, onUpdate]);

  const range = config[type] || { min: 80, max: 95 };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("typeLabel")}</label>
        <div className="flex gap-2">
          {[["standard", t("standardType")], ["wooden", t("woodenType")]].map(([k, l]) => (
            <button key={k} onClick={() => { setType(k); setPrice(config[k]?.min || 80); }}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("price")} ({range.min} - {range.max} {t("omr")})</label>
        <input type="range" min={range.min} max={range.max} value={price}
          onChange={(e) => setPrice(parseInt(e.target.value))}
          className="w-full accent-gray-900" />
        <p className="text-center text-lg font-black font-mono-en mt-2">{price} {t("omr")}</p>
      </div>
    </div>
  );
}

function NightstandBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [type, setType] = useState("standard");
  const [mode, setMode] = useState<"fixed" | "custom">("fixed");
  const [customLength, setCustomLength] = useState(50);
  const [customWidth, setCustomWidth] = useState(50);
  const [customPrice, setCustomPrice] = useState(30);
  const [wantsLegs, setWantsLegs] = useState(false);

  useEffect(() => {
    const typeLabel = type === "round" ? t("roundType") : t("standardType");
    // "مع أرجل" is informational only — it never changes the price.
    const legs = wantsLegs ? " - مع أرجل" : "";
    if (mode === "fixed") {
      const price = config[type] || (type === "round" ? 50 : 30);
      onUpdate(`كومودينو ${typeLabel}${legs}`, price, 0);
    } else {
      onUpdate(`كومودينو ${typeLabel} - ${customLength}×${customWidth} سم${legs}`, customPrice, 0);
    }
  }, [type, mode, customLength, customWidth, customPrice, wantsLegs, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("nightstandType")}</label>
        <div className="flex gap-2">
          {[["standard", "Standard"], ["round", "Round"]].map(([k, l]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("pricingMethod")}</label>
        <div className="flex gap-2">
          {[["fixed", t("fixedMethod")], ["custom", t("customMethod")]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k as "fixed" | "custom")}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                mode === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
        {mode === "fixed" && (
          <p className="text-xs text-gray-400 mt-2 font-mono-en">{t("price")}: {config[type] || (type === "round" ? 50 : 30)} {t("omr")}</p>
        )}
      </div>
      {mode === "custom" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("lengthCm")}</label>
            <input type="number" min={1} value={customLength} onChange={(e) => setCustomLength(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("widthCm")}</label>
            <input type="number" min={1} value={customWidth} onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("priceOMR")}</label>
            <input type="number" min={0} step={0.5} value={customPrice} onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={wantsLegs} onChange={(e) => setWantsLegs(e.target.checked)} className="rounded" />
        {t("nightstandLegsLabel")}
      </label>
    </div>
  );
}

function DressingBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [length, setLength] = useState(2);
  const [lighting, setLighting] = useState(false);
  const [lightCount, setLightCount] = useState(1);

  useEffect(() => {
    const pricePerMeter = config.pricePerMeter || 120;
    const price = length * pricePerMeter;
    const extras = lighting ? lightCount * (config.lighting || 20) : 0;
    onUpdate(`تسريحة - ${length} م.ط`, price, extras);
  }, [length, lighting, lightCount, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("measurementLabel")}</label>
        <div className="flex gap-3 items-center">
          <input type="range" min={1} max={20} step={0.5} value={length}
            onChange={(e) => setLength(parseFloat(e.target.value))}
            className="flex-1 accent-gray-900" />
          <input type="number" min={1} max={20} step={0.5} value={length}
            onChange={(e) => setLength(parseFloat(e.target.value) || 1)}
            className="w-20 border border-gray-200 rounded px-2 py-2 text-sm font-mono-en text-center" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("lightingLabel")}</label>
        <div className="flex gap-2">
          {[[false, t("withoutLighting")], [true, t("withLighting")]].map(([v, l]) => (
            <button key={String(v)} onClick={() => setLighting(v as boolean)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                lighting === v ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l as string}
            </button>
          ))}
        </div>
        {lighting && (
          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("lightingsCount")} ({config.lighting || 20} {t("omr")})</label>
            <input type="number" min={1} value={lightCount} onChange={(e) => setLightCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
        )}
      </div>
    </div>
  );
}

function LaundryBuilder({ config, onUpdate }: { config: any; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [area, setArea] = useState(4);
  const [lighting, setLighting] = useState(false);
  const [lightCount, setLightCount] = useState(1);

  useEffect(() => {
    const pricePerSqm = config.pricePerSqm || 60;
    const price = area * pricePerSqm;
    const extras = lighting ? lightCount * (config.lighting || 20) : 0;
    onUpdate(`غرفة غسيل - ${area} م²`, price, extras);
  }, [area, lighting, lightCount, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("areaSqm")}</label>
        <div className="flex gap-3 items-center">
          <input type="range" min={1} max={20} step={1} value={area}
            onChange={(e) => setArea(parseInt(e.target.value))}
            className="flex-1 accent-gray-900" />
          <input type="number" min={1} max={20} step={1} value={area}
            onChange={(e) => setArea(parseInt(e.target.value) || 1)}
            className="w-20 border border-gray-200 rounded px-2 py-2 text-sm font-mono-en text-center" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("lightingLabel")}</label>
        <div className="flex gap-2">
          {[[false, t("withoutLighting")], [true, t("withLighting")]].map(([v, l]) => (
            <button key={String(v)} onClick={() => setLighting(v as boolean)}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                lighting === v ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l as string}
            </button>
          ))}
        </div>
        {lighting && (
          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("lightingsCount")} ({config.lighting || 20} {t("omr")})</label>
            <input type="number" min={1} value={lightCount} onChange={(e) => setLightCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
        )}
      </div>
    </div>
  );
}

function GenericBuilder({ cat, onUpdate }: { cat: Category; onUpdate: (d: string, p: number, e: number) => void }) {
  const { t } = useI18n();
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(cat.basePrice || 0);
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [lighting, setLighting] = useState(false);

  useEffect(() => {
    const config = cat.config || {};
    let calculatedPrice = price;
    let extras = 0;

    if (cat.pricingType === "per_sqm") {
      const area = width * height;
      calculatedPrice = area * (config.pricePerSqm || cat.basePrice || 50);
    } else if (cat.pricingType === "per_meter") {
      calculatedPrice = width * (config.pricePerMeter || cat.basePrice || 120);
    }

    if (lighting && config.lighting) extras = config.lighting;

    const finalDesc = desc || `${cat.nameAr} - ${cat.pricingType === "manual" ? t("customItemLabel") : `${width}${cat.pricingType === "per_sqm" ? `×${height}م` : "م"}`}`;
    onUpdate(finalDesc, calculatedPrice, extras);
  }, [desc, price, width, height, lighting, cat, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("itemDescriptionLabel")}</label>
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm"
          placeholder={`${cat.nameAr} - ${t("itemDescriptionLabel")}`} />
      </div>

      {cat.pricingType === "manual" ? (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("priceOMR")}</label>
          <input type="number" step={0.5} min={0} value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
              {cat.pricingType === "per_meter" ? t("lengthM") : t("widthM")}
            </label>
            <input type="number" step={0.1} min={0.5} value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0.5)}
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
          </div>
          {cat.pricingType === "per_sqm" && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("heightM")}</label>
              <input type="number" step={0.1} min={0.5} value={height} onChange={(e) => setHeight(parseFloat(e.target.value) || 0.5)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en text-center" />
            </div>
          )}
        </div>
      )}

      {cat.config?.lighting && (
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={lighting} onChange={(e) => setLighting(e.target.checked)} className="rounded" />
          {t("lightingLabel")} (+{cat.config.lighting} {t("omr")})
        </label>
      )}
    </div>
  );
}

// === Unified dispatcher ===

export function CategoryBuilder({
  cat,
  governorate,
  wilayat,
  onUpdate,
}: {
  cat: Category;
  governorate: string;
  wilayat: string;
  onUpdate: (d: string, p: number, e: number) => void;
}) {
  const config = cat.config
    ? typeof cat.config === "string"
      ? JSON.parse(cat.config)
      : cat.config
    : {};

  switch (cat.id) {
    case "kitchens":
      return <KitchenBuilder config={config} governorate={governorate} wilayat={wilayat} onUpdate={onUpdate} />;
    case "cabinets":
      return <CabinetBuilder config={config} onUpdate={onUpdate} />;
    case "nightstand":
      return <NightstandBuilder config={config} onUpdate={onUpdate} />;
    case "curtains":
      return <CurtainBuilder config={config} wilayat={wilayat} onUpdate={onUpdate} />;
    case "dressing-table":
      return <DressingBuilder config={config} onUpdate={onUpdate} />;
    case "bed":
      return <BedBuilder config={config} onUpdate={onUpdate} />;
    case "cladding":
      return <CladdingBuilder config={config} onUpdate={onUpdate} />;
    case "sofa-set":
      return <SofaBuilder config={config} onUpdate={onUpdate} />;
    case "laundry":
      return <LaundryBuilder config={config} onUpdate={onUpdate} />;
    default:
      return <GenericBuilder cat={cat} onUpdate={onUpdate} />;
  }
}
