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

// The 4th argument (details) carries the builder's own control state so an
// already-added line item can be re-opened in its builder with every field
// pre-filled (edit-in-builder). Passing it is optional for backward-compat.
type BuilderUpdate = (d: string, p: number, e: number, details?: Record<string, any>) => void;
type BuilderInitial = Record<string, any> | undefined;

// Normalise anything a keyboard might produce for a number into plain
// Latin digits + a single "." separator. On an Arabic-locale iPad the
// decimal keypad emits the Arabic decimal separator "٫" (U+066B) and often
// Arabic-Indic / Persian digits — if those aren't converted they get
// stripped, so the decimal key looks like it "does nothing". We map:
//   • Arabic-Indic (٠-٩) & Persian (۰-۹) digits -> 0-9
//   • every separator variant (. , ، ٫ ٬) -> "."
// then keep only digits and collapse to one dot.
export function normalizeNumeric(raw: string): string {
  let s = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[.,،٫٬⸲⁄]/g, ".")
    .replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s;
}

// A decimal-friendly number field. Native type="number" (controlled) drops the
// decimal point while typing ("2." -> "2"), so measurements like 2.4 / 3.7 are
// impossible to enter. This keeps the raw text while editing, accepts every
// decimal-separator variant (see normalizeNumeric), shows the decimal keypad on
// iPad, and clamps on blur — so decimals type smoothly everywhere.
export function NumField({
  value, onChange, min, max, int, stepper, className, placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number; max?: number; int?: boolean; stepper?: boolean;
  className?: string; placeholder?: string;
}) {
  const [text, setText] = useState<string>(value != null ? String(value) : "");

  // Stepper mode: circular − / + buttons around the value, for whole-number
  // counts (glass doors, lights, curtains…). Clamps to min/max on each press.
  if (stepper) {
    const lo = min ?? 0;
    const dec = () => onChange(Math.max(lo, value - 1));
    const inc = () => onChange(max != null ? Math.min(max, value + 1) : value + 1);
    return (
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={inc} aria-label="+"
          className="w-11 h-11 rounded-full border border-gray-300 text-gray-700 font-bold text-xl leading-none flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
          disabled={max != null && value >= max}>+</button>
        <span className="w-10 text-center font-mono-en font-black text-lg text-gray-900">{value}</span>
        <button type="button" onClick={dec} aria-label="−"
          className="w-11 h-11 rounded-full border border-gray-300 text-gray-700 font-bold text-xl leading-none flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
          disabled={value <= lo}>−</button>
      </div>
    );
  }

  // Re-sync when the value is changed from outside (e.g. a slider).
  useEffect(() => {
    if (parseFloat(text) !== value) setText(value != null ? String(value) : "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (raw: string) => {
    let cleaned = normalizeNumeric(raw);
    if (int) cleaned = cleaned.replace(/\./g, "");
    setText(cleaned);
    const n = parseFloat(cleaned);
    if (!isNaN(n)) onChange(max != null && n > max ? max : n);
  };

  const handleBlur = () => {
    let n = parseFloat(text);
    if (isNaN(n)) n = min ?? 0;
    if (int) n = Math.round(n);
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    onChange(n);
    setText(String(n));
  };

  return (
    <input
      type="text"
      inputMode={int ? "numeric" : "decimal"}
      dir="ltr"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
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

function KitchenBuilder({ config, governorate, wilayat, onUpdate, initial }: { config: any; governorate: string; wilayat: string; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [length, setLength] = useState(initial?.length ?? 4);
  const [unitType, setUnitType] = useState<"1unit" | "2unit" | "3unit">(initial?.unitType ?? "2unit");
  const [island, setIsland] = useState<"none" | "small" | "large">(initial?.island ?? "none");
  const [manualBase, setManualBase] = useState(initial?.manualBase ?? 130);

  const PORCELAIN_PRICE = config?.porcelainSurcharge || 55;
  const unitMultiplier = unitType === "3unit" ? 3 : unitType === "1unit" ? 1 : 2;
  const autoBase = getKitchenBasePrice(governorate, wilayat);
  const isManual = autoBase === null;
  const basePrice = isManual ? manualBase : autoBase;
  const pricePerSqm = (basePrice * unitMultiplier) + PORCELAIN_PRICE;
  const area = Math.round(length * 100) / 100;

  const ISLAND_PRICES = { small: config?.island?.small || 390, large: config?.island?.large || 600 };

  useEffect(() => {
    const price = area * pricePerSqm;
    const extras = island !== "none" ? ISLAND_PRICES[island] : 0;
    const unitLabel = unitType === "3unit" ? t("unit3Label") : unitType === "1unit" ? t("unit1Label") : t("unit2Label");
    const desc = `مطبخ MDF - ${unitLabel} - ${length}م`;
    onUpdate(desc, price, extras, { length, unitType, island, manualBase });
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
          <input type="range" min={2} max={15} step={0.1} value={length}
            onChange={(e) => setLength(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
          <NumField value={length} onChange={setLength} min={2} max={15}
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
          {([["1unit", t("unit1Label")], ["2unit", t("unit2Label")], ["3unit", t("unit3Label")]] as const).map(([k, l]) => (
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
          <NumField value={manualBase} onChange={setManualBase} min={1} int
            className="field font-mono-en text-center" />
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

// Pantry: priced exactly like a 1-unit kitchen — length × (wilayat base price
// + porcelain surcharge). No unit toggle or island.
function PantryBuilder({ config, governorate, wilayat, onUpdate, initial }: { config: any; governorate: string; wilayat: string; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [length, setLength] = useState(initial?.length ?? 3);
  const [manualBase, setManualBase] = useState(initial?.manualBase ?? 130);

  const PORCELAIN_PRICE = config?.porcelainSurcharge || 55;
  const autoBase = getKitchenBasePrice(governorate, wilayat);
  const isManual = autoBase === null;
  const basePrice = isManual ? manualBase : autoBase;
  const pricePerSqm = basePrice + PORCELAIN_PRICE; // 1 unit
  const area = Math.round(length * 100) / 100;

  useEffect(() => {
    const price = area * pricePerSqm;
    onUpdate(`بانتري - ${length}م`, price, 0, { length, manualBase });
  }, [length, basePrice, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("lengthM")}</label>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{t("lengthM")}</span>
          <span className="text-xs font-mono-en font-bold">{length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={1} max={15} step={0.1} value={length}
            onChange={(e) => setLength(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
          <NumField value={length} onChange={setLength} min={1} max={15}
            className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
        </div>
        <div className="mt-2 text-center py-2 bg-gray-50 rounded border border-gray-100">
          <span className="text-sm text-gray-600">{t("areaLabel")}: </span>
          <span className="font-bold font-mono-en text-gray-900">{area.toFixed(2)}</span>
          <span className="text-sm text-gray-600"> {t("sqmUnit")}</span>
        </div>
      </div>

      {isManual && (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("pricePerMeterLabel")} (OMR)</label>
          <NumField value={manualBase} onChange={setManualBase} min={1} int
            className="field font-mono-en text-center" />
          <p className="text-xs text-amber-600 mt-1">{governorate}: {t("manualPriceHint")}</p>
        </div>
      )}

      <div className="text-center py-2 bg-gray-50 rounded border border-gray-100">
        <p className="text-xs text-gray-500">
          {wilayat || governorate}: {basePrice} + {PORCELAIN_PRICE} ({t("porcelain")}) = <span className="font-bold font-mono-en">{pricePerSqm.toFixed(3)}</span> {t("omrPerSqm")}
        </p>
      </div>
    </div>
  );
}

function CabinetBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [width, setWidth] = useState(initial?.width ?? 1.5);
  const [height, setHeight] = useState(initial?.height ?? 2.4);
  const [shape, setShape] = useState(initial?.shape ?? "single");
  // سعر الباب الزجاجي حسب الارتفاع (قابل للضبط عبر config.glassDoorPrices).
  const GLASS_OPTIONS = [
    { key: "3", label: "ارتفاع ٣ م", short: "٣م", price: config.glassDoorPrices?.["3"] ?? 60 },
    { key: "2.4", label: "ارتفاع ٢.٤ م", short: "٢.٤م", price: config.glassDoorPrices?.["2.4"] ?? 45 },
    { key: "storage", label: "ستوريج علوي ٦٠ سم", short: "ستوريج", price: config.glassDoorPrices?.storage ?? 28 },
  ];

  // عدد الأبواب لكل قياس على حدة، مثل { "3": 6, "2.4": 5, storage: 3 }.
  // يدعم الطلبات القديمة التي كانت تحفظ عدداً واحداً + نوعاً واحداً.
  const initialCounts: Record<string, number> =
    initial?.glassCounts ??
    ((initial?.glassDoors ?? 0) > 0 ? { [initial?.glassType ?? "3"]: initial!.glassDoors } : {});

  const [glassEnabled, setGlassEnabled] = useState<boolean>(
    initial?.glassEnabled ?? Object.values(initialCounts).some((n) => (n as number) > 0)
  );
  const [glassCounts, setGlassCounts] = useState<Record<string, number>>(initialCounts);
  const [leds, setLeds] = useState(initial?.leds ?? 0);
  const [back18, setBack18] = useState<boolean>(Boolean(initial?.back18));
  const [backSqm, setBackSqm] = useState<number>(initial?.backSqm ?? 1);

  const backRate = config.back18 || 40; // سعر المتر المربع للخلفية ١٨ ملي

  const setGlassCount = (key: string, n: number) =>
    setGlassCounts((prev) => ({ ...prev, [key]: n }));

  const totalGlass = glassEnabled
    ? GLASS_OPTIONS.reduce((s, o) => s + (glassCounts[o.key] || 0), 0)
    : 0;
  const glassCost = glassEnabled
    ? GLASS_OPTIONS.reduce((s, o) => s + (glassCounts[o.key] || 0) * o.price, 0)
    : 0;

  useEffect(() => {
    const area = width * height;
    const price = area * (config.basePrice || 54);
    const backCost = back18 ? backSqm * backRate : 0;
    const extras = glassCost + leds * (config.led || 25) + backCost;
    const glassParts = GLASS_OPTIONS.filter((o) => (glassCounts[o.key] || 0) > 0).map(
      (o) => `${o.short}×${glassCounts[o.key]}`
    );
    const shapeName = shape === "L" ? "L" : shape === "U" ? "U" : "عادية";
    const parts = [`خزانة ${shapeName} ${width}×${height}م`];
    if (glassParts.length) parts.push(`زجاج: ${glassParts.join("، ")}`);
    if (leds > 0) parts.push(`إضاءة ×${leds}`);
    if (back18) parts.push(`خلفية ١٨ملي ${backSqm}م²`);
    const desc = parts.join(" · ");
    onUpdate(desc, price, extras, { width, height, shape, glassEnabled, glassCounts, leds, back18, backSqm });
  }, [width, height, shape, glassEnabled, glassCounts, glassCost, leds, back18, backSqm, backRate, config, onUpdate]);

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
          <NumField value={width} onChange={setWidth} min={0.5}
            className="field font-mono-en text-center" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("heightM")}</label>
          <NumField value={height} onChange={setHeight} min={0.5}
            className="field font-mono-en text-center" />
        </div>
      </div>
      <div>
        <button type="button" onClick={() => setGlassEnabled((v) => !v)}
          className={cn("w-full flex items-center justify-between px-4 py-3 rounded border text-sm font-bold transition-colors",
            glassEnabled ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
          <span>{t("glassDoors")}</span>
          <span>{glassEnabled ? "✓" : ""}</span>
        </button>

        {glassEnabled && (
          <div className="mt-3 space-y-2.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">القياسات — عدد الأبواب لكل ارتفاع</label>
            {GLASS_OPTIONS.map((o) => {
              const c = glassCounts[o.key] || 0;
              const active = c > 0;
              return (
                <div key={o.key}
                  className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    active ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white")}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 leading-tight">{o.label}</p>
                    <p className="text-xs text-gray-400 font-mono-en">{o.price} {t("omr")} / باب</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => setGlassCount(o.key, Math.max(0, c - 1))}
                      className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold text-lg leading-none flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                      disabled={c === 0} aria-label="−">−</button>
                    <span className="w-8 text-center font-mono-en font-black text-gray-900">{c}</span>
                    <button type="button" onClick={() => setGlassCount(o.key, c + 1)}
                      className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold text-lg leading-none flex items-center justify-center hover:bg-gray-100"
                      aria-label="+">+</button>
                  </div>
                  <div className="w-20 text-left flex-shrink-0">
                    {active && <span className="text-xs font-bold text-gray-600 font-mono-en">{(c * o.price).toFixed(3)}</span>}
                  </div>
                </div>
              );
            })}

            {totalGlass > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-gray-900 text-white px-4 py-2.5">
                <span className="text-sm font-bold">{t("glassDoors")} — {totalGlass} باب</span>
                <span className="font-mono-en font-black">{glassCost.toFixed(3)} {t("omr")}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("ledLighting")} ({config.led || 25} {t("omr")})</label>
        <NumField value={leds} onChange={setLeds} min={0} int stepper
          className="field font-mono-en text-center" />
      </div>
      <div>
        <button type="button" onClick={() => setBack18((v) => !v)}
          className={cn("w-full flex items-center justify-between px-4 py-3 rounded border text-sm font-bold transition-colors",
            back18 ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
          <span>خلفية ١٨ ملي ({backRate} {t("omrPerSqm")})</span>
          <span>{back18 ? "✓" : ""}</span>
        </button>
        {back18 && (
          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("areaSqm")}</label>
            <NumField value={backSqm} onChange={setBackSqm} min={0.1}
              className="field font-mono-en text-center" />
            <p className="text-xs text-gray-400 mt-1 font-mono-en text-center">
              {backSqm} × {backRate} = {(backSqm * backRate).toFixed(3)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CurtainBuilder({ config, wilayat, onUpdate, initial }: { config: any; wilayat: string; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const minCount = curtainMinCount(wilayat);
  const [type, setType] = useState(initial?.type ?? "chiffon");
  const [motor, setMotor] = useState<"manual" | "electric">(initial?.motor ?? "manual");
  const [count, setCount] = useState<number>(initial?.count ?? minCount);
  const [width, setWidth] = useState(initial?.width ?? 2);
  const [height, setHeight] = useState(initial?.height ?? 2);

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
    onUpdate(desc, price, motorSurcharge, { type, motor, count, width, height });
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
        <NumField value={count} onChange={setCount} min={minCount} int stepper
          className="field font-mono-en text-center" />
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
              <input type="range" min={1} max={20} step={0.1} value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
              <NumField value={width} onChange={setWidth} min={1} max={20}
                className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm font-mono-en text-center" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{t("heightM")}</span>
              <span className="text-xs font-mono-en font-bold">{height}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={20} step={0.1} value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
              <NumField value={height} onChange={setHeight} min={1} max={20}
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

// Legs option shared by the bed and nightstand builders: wooden (15 OMR) or
// aluminium (10 OMR), added to the line's extras. Prices are overridable via
// the category config (config.legs.wood / config.legs.aluminum).
function legWoodPrice(config: any) { return config?.legs?.wood ?? 15; }
function legAluPrice(config: any) { return config?.legs?.aluminum ?? 10; }
function legsExtra(config: any, legs: string): number {
  if (legs === "wood") return legWoodPrice(config);
  if (legs === "aluminum") return legAluPrice(config);
  return 0;
}
function legsDescSuffix(legs: string): string {
  if (legs === "wood") return " - أرجل خشبية";
  if (legs === "aluminum") return " - أرجل ألمنيوم";
  return "";
}

function LegsSelector({ value, onChange, config }: { value: string; onChange: (v: string) => void; config: any }) {
  const { t } = useI18n();
  const opts: Array<[string, string]> = [
    ["none", t("legsNone")],
    ["wood", `${t("legsWood")} (${legWoodPrice(config)})`],
    ["aluminum", `${t("legsAluminum")} (${legAluPrice(config)})`],
  ];
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-600 mb-2">{t("legsLabel")}</label>
      <div className="flex gap-2">
        {opts.map(([k, l]) => (
          <button key={k} type="button" onClick={() => onChange(k)}
            className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
              value === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const BED_PRICES: Record<string, Record<string, number>> = {
  wood:   { "90x190": 120, "100x200": 130, "120x200": 135, "180x200": 390, "200x200": 400, "220x220": 410 },
  fabric: { "90x190": 125, "100x200": 135, "120x200": 140, "180x200": 420, "200x200": 430, "220x220": 450 },
};
const BED_SIZES = ["90x190", "100x200", "120x200", "180x200", "200x200", "220x220"];

function BedBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [type, setType] = useState(initial?.type ?? "wood");
  const [size, setSize] = useState(initial?.size ?? "180x200");
  const [lighting, setLighting] = useState(initial?.lighting ?? false);
  const [legs, setLegs] = useState<string>(initial?.legs ?? "none");

  useEffect(() => {
    const price = BED_PRICES[type]?.[size] || 160;
    const extras = (lighting ? (config.lighting || 20) : 0) + legsExtra(config, legs);
    const typeLabel = type === "wood" ? "خشب" : "قماش";
    const desc = `سرير ${typeLabel} - ${size} سم${legsDescSuffix(legs)}`;
    onUpdate(desc, price, extras, { type, size, lighting, legs });
  }, [type, size, lighting, legs, config, onUpdate]);

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
      <LegsSelector value={legs} onChange={setLegs} config={config} />
    </div>
  );
}

function CladdingBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [type, setType] = useState(initial?.type ?? "type1");
  const [width, setWidth] = useState(initial?.width ?? 3);
  const [height, setHeight] = useState(initial?.height ?? 2.4);
  const [lighting, setLighting] = useState(initial?.lighting ?? false);
  const [lightCount, setLightCount] = useState(initial?.lightCount ?? 1);

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
    onUpdate(desc, price, lightSurcharge, { type, width, height, lighting, lightCount });
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
              <NumField value={width} onChange={setWidth} min={1} max={10}
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
              <NumField value={height} onChange={setHeight} min={1} max={10}
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
            <NumField value={lightCount} onChange={setLightCount} min={1} int stepper
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

function SofaBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [type, setType] = useState(initial?.type ?? "standard");
  const [price, setPrice] = useState(initial?.price ?? (config.standard?.min || 80));

  useEffect(() => {
    const typeLabel = type === "wooden" ? t("woodenType") : t("standardType");
    const desc = `طقم جلوس ${typeLabel}`;
    onUpdate(desc, price, 0, { type, price });
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

function NightstandBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [type, setType] = useState(initial?.type ?? "standard");
  const [mode, setMode] = useState<"fixed" | "custom">(initial?.mode ?? "fixed");
  const [customLength, setCustomLength] = useState(initial?.customLength ?? 50);
  const [customWidth, setCustomWidth] = useState(initial?.customWidth ?? 50);
  const [customPrice, setCustomPrice] = useState(initial?.customPrice ?? 30);
  const [legs, setLegs] = useState<string>(initial?.legs ?? "none");

  useEffect(() => {
    const typeLabel = type === "round" ? t("roundType") : t("standardType");
    const legsSuffix = legsDescSuffix(legs);
    const extras = legsExtra(config, legs);
    const details = { type, mode, customLength, customWidth, customPrice, legs };
    if (mode === "fixed") {
      const price = config[type] || (type === "round" ? 50 : 30);
      onUpdate(`كومودينو ${typeLabel}${legsSuffix}`, price, extras, details);
    } else {
      onUpdate(`كومودينو ${typeLabel} - ${customLength}×${customWidth} سم${legsSuffix}`, customPrice, extras, details);
    }
  }, [type, mode, customLength, customWidth, customPrice, legs, config, onUpdate]);

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
            <NumField value={customLength} onChange={setCustomLength} min={1} int
              className="field font-mono-en text-center" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("widthCm")}</label>
            <NumField value={customWidth} onChange={setCustomWidth} min={1} int
              className="field font-mono-en text-center" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("priceOMR")}</label>
            <NumField value={customPrice} onChange={setCustomPrice} min={0}
              className="field font-mono-en text-center" />
          </div>
        </div>
      )}
      <LegsSelector value={legs} onChange={setLegs} config={config} />
    </div>
  );
}

function DressingBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [length, setLength] = useState(initial?.length ?? 2);
  const [lighting, setLighting] = useState(initial?.lighting ?? false);
  const [lightCount, setLightCount] = useState(initial?.lightCount ?? 1);

  useEffect(() => {
    const pricePerMeter = config.pricePerMeter || 120;
    const price = length * pricePerMeter;
    const extras = lighting ? lightCount * (config.lighting || 20) : 0;
    onUpdate(`تسريحة - ${length} م.ط`, price, extras, { length, lighting, lightCount });
  }, [length, lighting, lightCount, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("measurementLabel")}</label>
        <div className="flex gap-3 items-center">
          <input type="range" min={1} max={20} step={0.5} value={length}
            onChange={(e) => setLength(parseFloat(e.target.value))}
            className="flex-1 accent-gray-900" />
          <NumField value={length} onChange={setLength} min={1} max={20}
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
            <NumField value={lightCount} onChange={setLightCount} min={1} int stepper
              className="field font-mono-en text-center" />
          </div>
        )}
      </div>
    </div>
  );
}

function LaundryBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [area, setArea] = useState(initial?.area ?? 4);
  const [lighting, setLighting] = useState(initial?.lighting ?? false);
  const [lightCount, setLightCount] = useState(initial?.lightCount ?? 1);

  useEffect(() => {
    const pricePerSqm = config.pricePerSqm || 60;
    const price = area * pricePerSqm;
    const extras = lighting ? lightCount * (config.lighting || 20) : 0;
    onUpdate(`غرفة غسيل - ${area} م²`, price, extras, { area, lighting, lightCount });
  }, [area, lighting, lightCount, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("areaSqm")}</label>
        <div className="flex gap-3 items-center">
          <input type="range" min={1} max={20} step={0.1} value={area}
            onChange={(e) => setArea(parseFloat(e.target.value))}
            className="flex-1 accent-gray-900" />
          <NumField value={area} onChange={setArea} min={1} max={20}
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
            <NumField value={lightCount} onChange={setLightCount} min={1} int stepper
              className="field font-mono-en text-center" />
          </div>
        )}
      </div>
    </div>
  );
}

function TVTableBuilder({ config, onUpdate, initial }: { config: any; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const perSqm = config?.pricePerSqm ?? config?.basePrice ?? 50;
  const perMeter = config?.pricePerMeter ?? 65;
  // Two TV-table types: "cladding" is priced by area (width × height), "floor"
  // is priced only by linear metre. Back-compat with the earlier method field.
  const [type, setType] = useState<"cladding" | "floor">(
    initial?.type ?? (initial?.method === "meter" ? "floor" : "cladding")
  );
  const [width, setWidth] = useState(initial?.width ?? 1.5);
  const [height, setHeight] = useState(initial?.height ?? 0.5);
  const [length, setLength] = useState(initial?.length ?? 2);

  useEffect(() => {
    let price: number;
    let desc: string;
    if (type === "floor") {
      price = length * perMeter;
      desc = `طاولة تلفزيون أرضية - ${length} م.ط`;
    } else {
      const area = Math.round(width * height * 100) / 100;
      price = area * perSqm;
      desc = `طاولة تلفزيون مع كلادينج - ${width}×${height}م = ${area} م²`;
    }
    onUpdate(desc, price, 0, { type, width, height, length });
  }, [type, width, height, length, config, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">{t("typeLabel")}</label>
        <div className="flex gap-2">
          {([["cladding", t("tvTypeCladding")], ["floor", t("tvTypeFloor")]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setType(k as "cladding" | "floor")}
              className={cn("flex-1 py-2.5 rounded text-sm font-bold border transition-colors",
                type === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {type === "floor" ? (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("lengthM")} (م.ط)</label>
          <NumField value={length} onChange={setLength} min={0.5} className="field font-mono-en text-center" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("widthM")}</label>
            <NumField value={width} onChange={setWidth} min={0.5} className="field font-mono-en text-center" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("heightM")}</label>
            <NumField value={height} onChange={setHeight} min={0.5} className="field font-mono-en text-center" />
          </div>
        </div>
      )}

      <div className="text-center py-2 bg-gray-50 rounded border border-gray-100">
        <p className="text-sm font-bold font-mono-en text-gray-900">
          {type === "floor"
            ? `${length} م.ط × ${perMeter} = ${(length * perMeter).toFixed(3)}`
            : `${(Math.round(width * height * 100) / 100).toFixed(2)} م² × ${perSqm} = ${((Math.round(width * height * 100) / 100) * perSqm).toFixed(3)}`} {t("omr")}
        </p>
      </div>
    </div>
  );
}

function GenericBuilder({ cat, onUpdate, initial }: { cat: Category; onUpdate: BuilderUpdate; initial?: BuilderInitial }) {
  const { t } = useI18n();
  const [desc, setDesc] = useState(initial?.desc ?? "");
  const [price, setPrice] = useState(initial?.price ?? (cat.basePrice || 0));
  const [width, setWidth] = useState(initial?.width ?? 1);
  const [height, setHeight] = useState(initial?.height ?? 1);
  const [lighting, setLighting] = useState(initial?.lighting ?? false);

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
    onUpdate(finalDesc, calculatedPrice, extras, { desc, price, width, height, lighting });
  }, [desc, price, width, height, lighting, cat, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("itemDescriptionLabel")}</label>
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          className="field"
          placeholder={`${cat.nameAr} - ${t("itemDescriptionLabel")}`} />
      </div>

      {cat.pricingType === "manual" ? (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("priceOMR")}</label>
          <NumField value={price} onChange={setPrice} min={0}
            className="field font-mono-en text-center" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
              {cat.pricingType === "per_meter" ? t("lengthM") : t("widthM")}
            </label>
            <NumField value={width} onChange={setWidth} min={0.5}
              className="field font-mono-en text-center" />
          </div>
          {cat.pricingType === "per_sqm" && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("heightM")}</label>
              <NumField value={height} onChange={setHeight} min={0.5}
                className="field font-mono-en text-center" />
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
  initial,
}: {
  cat: Category;
  governorate: string;
  wilayat: string;
  onUpdate: BuilderUpdate;
  initial?: BuilderInitial;
}) {
  const config = cat.config
    ? typeof cat.config === "string"
      ? JSON.parse(cat.config)
      : cat.config
    : {};

  switch (cat.id) {
    case "kitchens":
      return <KitchenBuilder config={config} governorate={governorate} wilayat={wilayat} onUpdate={onUpdate} initial={initial} />;
    case "pantry":
      return <PantryBuilder config={config} governorate={governorate} wilayat={wilayat} onUpdate={onUpdate} initial={initial} />;
    case "cabinets":
      return <CabinetBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "nightstand":
      return <NightstandBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "curtains":
      return <CurtainBuilder config={config} wilayat={wilayat} onUpdate={onUpdate} initial={initial} />;
    case "dressing-table":
      return <DressingBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "bed":
      return <BedBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "cladding":
      return <CladdingBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "sofa-set":
      return <SofaBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "laundry":
      return <LaundryBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    case "tv-table":
      return <TVTableBuilder config={config} onUpdate={onUpdate} initial={initial} />;
    default:
      return <GenericBuilder cat={cat} onUpdate={onUpdate} initial={initial} />;
  }
}
