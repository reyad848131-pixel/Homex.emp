// The central "production specs" catalog. Admins (owners + designated — the
// accountant Deepak and the foreman Othman) define the option lists here — wood
// types, colours/codes, fabric types/codes, channel (تشانالات) types, and any
// custom field. Whatever is defined here becomes selectable inside the quote
// builders, so every produced item carries full production specs the workers
// read off the production/foreman pages.
//
// Stored as a single JSON blob in the `specs_catalog` settings key.

export interface SpecField {
  // Stable key used inside the item's details.specs map. Generated once and
  // never changed (renaming only touches the labels), so saved items keep their
  // values when a field is relabelled.
  id: string;
  labelAr: string;
  labelEn: string;
  // Input mode:
  //  • "list" — a dropdown of `options`, plus an "Other…" escape to type a
  //    custom value (e.g. wood codes: pick a known one or type a new one).
  //  • "text" — a plain free-text box, no options (e.g. fabric codes, which run
  //    into the thousands — staff just type the code).
  mode: "list" | "text";
  // The selectable options for this field (the dropdown values) in "list" mode.
  options: string[];
  // Category ids this field applies to (see CategoryBuilder's `cat.id`). Empty
  // means "all categories". Lets a field like "نوع القماش" show only on
  // upholstered items while "نوع الخشب" shows everywhere.
  categories: string[];
}

export interface SpecsCatalog {
  fields: SpecField[];
}

// Seed fields the factory asked for. Options start empty — the admins fill them
// in from the Catalog page; categories empty = shown on every category.
export const DEFAULT_SPECS_CATALOG: SpecsCatalog = {
  fields: [
    { id: "wood", labelAr: "نوع الخشب", labelEn: "Wood type", mode: "list", options: [], categories: [] },
    { id: "woodCode", labelAr: "كود الخشب", labelEn: "Wood code", mode: "list", options: [], categories: [] },
    { id: "fabric", labelAr: "نوع القماش", labelEn: "Fabric type", mode: "list", options: [], categories: [] },
    { id: "fabricCode", labelAr: "كود القماش", labelEn: "Fabric code", mode: "text", options: [], categories: [] },
    { id: "channel", labelAr: "نوع التشانالات", labelEn: "Channel type", mode: "list", options: [], categories: [] },
  ],
};

function cleanStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

let idSeq = 0;
function fieldId(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 40);
  return `f${Date.now().toString(36)}${(idSeq++).toString(36)}`;
}

// Validate/normalise any payload into a clean catalog, so a tampered or partial
// body can never inject arbitrary shapes into storage.
export function mergeSpecsCatalog(raw: unknown): SpecsCatalog {
  const src = (raw && typeof raw === "object" ? (raw as any) : {}) as { fields?: unknown };
  if (!Array.isArray(src.fields)) return { fields: [] };
  const ids = new Set<string>();
  const fields: SpecField[] = [];
  for (const f of src.fields) {
    if (!f || typeof f !== "object") continue;
    const ff = f as any;
    const labelAr = typeof ff.labelAr === "string" ? ff.labelAr.trim().slice(0, 60) : "";
    const labelEn = typeof ff.labelEn === "string" ? ff.labelEn.trim().slice(0, 60) : "";
    if (!labelAr && !labelEn) continue;
    let id = fieldId(ff.id);
    while (ids.has(id)) id = `${id}_${(idSeq++).toString(36)}`;
    ids.add(id);
    fields.push({
      id,
      labelAr: labelAr || labelEn,
      labelEn: labelEn || labelAr,
      mode: ff.mode === "text" ? "text" : "list",
      options: cleanStrings(ff.options).slice(0, 300),
      categories: cleanStrings(ff.categories).slice(0, 50),
    });
    if (fields.length >= 60) break;
  }
  return { fields };
}

// The fields that apply to one category (category-scoped + the "all" fields).
export function fieldsForCategory(catalog: SpecsCatalog, categoryId: string): SpecField[] {
  return catalog.fields.filter(
    (f) => f.categories.length === 0 || f.categories.includes(categoryId)
  );
}
