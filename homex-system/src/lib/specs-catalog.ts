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

// A trackable component/add-on that can be attached to a produced item (glass
// doors, lighting, handles, shelves…). Unlike a SpecField (a fixed spec value),
// each attached component carries a live status (not arrived → arrived →
// installed) that the foreman updates from the item page / its barcode.
export interface ComponentDef {
  id: string;
  labelAr: string;
  labelEn: string;
  // Category ids this component applies to (empty = all), so the picker shows
  // only relevant components per item.
  categories: string[];
}

export interface SpecsCatalog {
  fields: SpecField[];
  components: ComponentDef[];
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
  components: [],
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
  const src = (raw && typeof raw === "object" ? (raw as any) : {}) as { fields?: unknown; components?: unknown };
  const components = mergeComponents(src.components);
  if (!Array.isArray(src.fields)) return { fields: [], components };
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
  return { fields, components };
}

// Validate/normalise the trackable-component definitions.
function mergeComponents(raw: unknown): ComponentDef[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: ComponentDef[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const cc = c as any;
    const labelAr = typeof cc.labelAr === "string" ? cc.labelAr.trim().slice(0, 60) : "";
    const labelEn = typeof cc.labelEn === "string" ? cc.labelEn.trim().slice(0, 60) : "";
    if (!labelAr && !labelEn) continue;
    let id = fieldId(cc.id);
    while (ids.has(id)) id = `${id}_${(idSeq++).toString(36)}`;
    ids.add(id);
    out.push({
      id,
      labelAr: labelAr || labelEn,
      labelEn: labelEn || labelAr,
      categories: cleanStrings(cc.categories).slice(0, 50),
    });
    if (out.length >= 100) break;
  }
  return out;
}

// Turn an item's stored details JSON (its `.specs` map of fieldId → value) into
// labelled rows using the catalog. Unknown/removed fields are kept (labelled by
// their id) so nothing silently disappears. Shared by the foreman file and the
// per-item (barcode) page.
export function specRowsFromDetails(detailsRaw: string | null, catalog: SpecsCatalog): { labelAr: string; labelEn: string; value: string }[] {
  let specs: Record<string, unknown> = {};
  try {
    const d = detailsRaw ? JSON.parse(detailsRaw) : null;
    if (d && typeof d.specs === "object" && d.specs) specs = d.specs as Record<string, unknown>;
  } catch { /* ignore malformed details */ }
  const rows: { labelAr: string; labelEn: string; value: string }[] = [];
  for (const [fid, val] of Object.entries(specs)) {
    const value = typeof val === "string" ? val.trim() : "";
    if (!value) continue;
    const f = catalog.fields.find((x) => x.id === fid);
    rows.push({ labelAr: f?.labelAr || fid, labelEn: f?.labelEn || fid, value });
  }
  return rows;
}

// The components that apply to one category (category-scoped + the "all" ones).
export function componentsForCategory(catalog: SpecsCatalog, categoryId: string): ComponentDef[] {
  return catalog.components.filter(
    (c) => c.categories.length === 0 || c.categories.includes(categoryId)
  );
}

// The fields that apply to one category (category-scoped + the "all" fields).
export function fieldsForCategory(catalog: SpecsCatalog, categoryId: string): SpecField[] {
  return catalog.fields.filter(
    (f) => f.categories.length === 0 || f.categories.includes(categoryId)
  );
}
