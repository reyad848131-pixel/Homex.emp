// Production structure config, stored in settings (no schema migration, fully
// editable by the foreman). Two pieces:
//
//  • Stations (الأقسام): the factory sections. Each is run by ONE main worker
//    (عثمان يتعامل مع الـ main worker فقط) with sub-workers under him. A station's
//    name doubles as the production stage it performs (e.g. "تقطيع", "تنجيد",
//    "تشطيب") so a piece routed to that stage has a responsible main worker.
//
//  • Pipelines (المراحل): the ordered list of stages each category passes
//    through (e.g. bed: تقطيع ← تنجيد ← تشطيب). Applying a category's pipeline to
//    an item creates its production stages, auto-assigned to each station's main
//    worker.

export interface Station {
  id: string;
  name: string;              // the stage/station name, e.g. "تقطيع"
  mainWorkerId: string | null;
  subWorkerIds: string[];
}

export interface ProductionConfig {
  stations: Station[];
  // category id (slug, e.g. "bed") -> ordered stage names
  pipelines: Record<string, string[]>;
  // used for any category without its own pipeline
  defaultPipeline: string[];
}

export const DEFAULT_PRODUCTION: ProductionConfig = {
  stations: [],
  pipelines: {
    // Seed the one example the factory gave; the rest are set from the UI.
    bed: ["تقطيع", "تنجيد", "تشطيب"],
  },
  defaultPipeline: ["تحضير", "تصنيع", "تشطيب"],
};

function cleanStr(v: unknown, max = 60): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function cleanIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s); out.push(s);
  }
  return out;
}

let seq = 0;
function stationId(raw: unknown): string {
  const s = cleanStr(raw, 40);
  return s || `st${Date.now().toString(36)}${(seq++).toString(36)}`;
}

export function mergeProduction(raw: unknown): ProductionConfig {
  const src = (raw && typeof raw === "object" ? (raw as any) : {}) as Partial<ProductionConfig>;

  const ids = new Set<string>();
  const stations: Station[] = [];
  if (Array.isArray(src.stations)) {
    for (const s of src.stations) {
      if (!s || typeof s !== "object") continue;
      const name = cleanStr((s as any).name);
      if (!name) continue;
      let id = stationId((s as any).id);
      while (ids.has(id)) id = `${id}_${(seq++).toString(36)}`;
      ids.add(id);
      stations.push({
        id,
        name,
        mainWorkerId: cleanStr((s as any).mainWorkerId) || null,
        subWorkerIds: cleanIds((s as any).subWorkerIds),
      });
      if (stations.length >= 100) break;
    }
  }

  const pipelines: Record<string, string[]> = {};
  if (src.pipelines && typeof src.pipelines === "object") {
    for (const [cat, stages] of Object.entries(src.pipelines)) {
      const key = cleanStr(cat, 40);
      if (!key) continue;
      const list = Array.isArray(stages)
        ? stages.map((x) => cleanStr(x)).filter(Boolean).slice(0, 30)
        : [];
      pipelines[key] = list;
    }
  }

  const defaultPipeline = Array.isArray(src.defaultPipeline)
    ? src.defaultPipeline.map((x) => cleanStr(x)).filter(Boolean).slice(0, 30)
    : DEFAULT_PRODUCTION.defaultPipeline;

  return { stations, pipelines, defaultPipeline };
}

// The ordered stage names a category passes through (its own pipeline, or the
// default when it has none).
export function pipelineFor(cfg: ProductionConfig, categoryId: string): string[] {
  const own = cfg.pipelines[categoryId];
  return own && own.length ? own : cfg.defaultPipeline;
}

// The station (and thus responsible main worker) that performs a given stage.
export function stationForStage(cfg: ProductionConfig, stageName: string): Station | undefined {
  return cfg.stations.find((s) => s.name === stageName);
}
